/**
 * @class HDB
 * 
 * @description Query Builder for IndexedDB
 */

class HDB {

    static get READONLY() {
        return "readonly";
    }

    static get READWRITE() {
        return "readwrite";
    }

    static get ASC() {
        return "asc";
    }

    static get DESC() {
        return "desc";
    }

    /**
     * 
     * @param {String} database - database name
     * @param {String} table - table name
     * @param { {keyPath: String, autoIncrement:String, indexes:Array<{name: String, keyPath:String, options:Object}>} } config - configuration of table
     * 
     * @returns {Promise<HDB> | Promise<Error>} 
     */
    constructor(database, table, config = {keyPath: "", autoIncrement: "", indexes: []}){
        
        this.database = database;
        this.table = table;
        this.config = config;
        this.DB;

        /**
         * @property {Array.<String>} fields - select fields
         * @property {Object} condition - key-value pair object
         * @property {Array<{column: String, orderBy: String}>} orderBy - object in array.
         * @property {Number} limit
         * @property {Number} offset
         * @property {Object} updatePair - key-value pair object
         */
        this.Query = {
            fields: undefined,
            condition: undefined,
            orderBy: undefined,
            limit: undefined,
            offset: undefined,
            updatePair: undefined,
        };

        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open(this.database);

            dbRequest.onerror =  () => {
               reject(new Error("Open Database Fail.."));
            };
            
            dbRequest.onsuccess = async () => {
                this.DB = dbRequest.result;

                this.DB.onerror = (event) => {
                    throw new Error(`Database error:  ${event.target.errorCode}`);
                };

                resolve(this);
            };
            
            dbRequest.onupgradeneeded = (event) =>  {
                this.DB = event.currentTarget.result;

                const {keyPath, autoIncrement, indexes} = this.config;

                const store = this.DB.createObjectStore(this.table, {
                  keyPath,
                  autoIncrement,
                });

                indexes.forEach((index) => {
                    store.createIndex(index.name, index.keyPath, index.options);
                });
            };
        });
    }  

    /**
     * clear table
     */
    clearTable() {
        return new Promise((resolve, reject) => {
            const store = this._getObjectStore(HDB.READWRITE);
      
            const action = store.clear();
            
            action.onsuccess = () => {
                resolve(true);
            };
            
            action.onerror =  () => {
                reject(false);
            };
        });
       
    }

    /**
     * @param {String} mode
     * @returns {Promise<Boolean>} 
     */
    create(item) {
        return new Promise((resolve, reject) => {
            const store = this._getObjectStore(HDB.READWRITE);
      
            const action = store.add(item);
        
            action.onsuccess = async (event) => {
                resolve(await this.find(event.target.result));
            };
            
            action.onerror = () => {
                reject(false);
            };
        }) 
    }

    /**
     * 
     * @param {Array<Object>} fields 
     * @returns {HDB}
     */
    select(fields) {
        this.Query.fields = fields;
        return this;
    }

    /**
     * 
     * @param {Object} condition
     * @returns {HDB}
     */
    where(condition) {     
        condition = this._formatCondition(condition);

        if(this.Query.condition){
            this.Query.condition = Object.assign(this.Query.condition, condition)
        }else{
            this.Query.condition = condition;
        }

        return this;
    }

    skip(offset){  
        this.Query.offset = NumberHelper.isNatural(offset)?offset:0;
        return this;
    }

    take(limit){
        this.Query.limit = NumberHelper.isNatural(limit)?limit:0;
        return this;
    }

    orderBy(column, sortBy = HDB.ASC){
        sortBy = sortBy.includes(HDB.ASC) || sortBy.includes(HDB.DESC) ? sortBy : HDB.ASC;
        if(this.Query.orderBy){
            this.Query.orderBy.push({column, sortBy});
        }else{
            this.Query.orderBy = [{column, sortBy}];
        }
        return this;
    }

    /**
     * find item by pk
     * 
     * @param {Number|String} pk
     * @returns {Promise<Array<Object>>} 
     */
    find(pk) {
        return new Promise((resolve, reject) => {
            const store = this._getObjectStore(HDB.READONLY);
            
            pk = NumberHelper.parse(pk);

            const action = store.get(pk);
        
            action.onsuccess = () => {
                this._queryInit();
                resolve(action.result || null);
            };
            
            action.onerror = () => {
                reject(false);
            };
        });
    }
    
    /**
     * @returns {Array<Object>}
     */
    async get(){
        const result = await this._generateResult();
        var collection = result.map(target => {
            return target.item;
        });

        if(collection.length !== 0){

            // orderBy
            if(this.Query.orderBy){
                this.Query.orderBy.forEach(config => {
                    const {column, sortBy} = config;
                    const item = collection[0];
                    const sortNum = sortBy == HDB.ASC?1:-1;
    
                    if(NumberHelper.isNumber(item[column])){
                        collection.sort(function(a, b) {
                            if (a[column] > b[column]) return sortNum;
                            if (a[column] < b[column]) return -sortNum;
                            return 0;
                        });
                    }else if(DateHelper.isDate(item[column])){
                        collection.sort(function(a, b) {
                            const l = Date.parse(a[column]);
                            const r = Date.parse(b[column]);
                            if (l > r) return sortNum;
                            if (l < r) return -sortNum;
                            return 0;
                        });
                    }else{
                        collection.sort(function(a, b) {
                            if (a[column] > b[column]) return sortNum;
                            if (a[column] < b[column]) return -sortNum;
                            return 0;
                        });
                    }
                });
            }

            // take & skip
            if(this.Query.limit){
                const offset = this.Query.offset ||  0;
                collection = collection.slice(offset, offset + this.Query.limit);
            }
    
        }

        this._queryInit();
        return collection;
    }

    /**
     * @returns {Object|null}
     */
    async first(){
        this.Query.limit = 1;
        const result = await this.get();
        return result.length === 0?null:result[0];
    }

    /**
     * @throws {String}
     * @param {Object} pair key-value pair you want changed
     * @returns {Boolean}
     */
    async update(pair){
        
        if(this.Query.fields){
            throw new Error("cannot use 'select' when updating");
        }

        this.Query.updatePair = pair;
        const result = await this._generateResult();

        let isSuccess = true;
        for(let i=0; i<result.length; i++){
            if(!await this._updatePromise(result[i])){
                isSuccess = false;
            }
        }

        this._queryInit();
        return isSuccess;
    }

    /**
     * @throws {String}
     * @returns {Boolean}
     */
    async delete(){

        if(this.Query.fields){
            throw new Error("cannot use 'select' when deleting");
        }

        const result = await this._generateResult();

        let isSuccess = true;
        for(let i=0; i<result.length; i++){
            const pk = result[i].pk;
            if(!await this._deletePromise(pk)){
                isSuccess = false;
            }
        }

        this._queryInit();
        return isSuccess;
    }
    
    /**
     * @returns {Number}
     */
    async count(){
        const result = await this._generateResult();
        return result.length;
    }

    /**
     * @private
     * 
     * @throws {String}
     * 
     * @param {String} mode
     * @returns {IDBObjectStore} 
     */
    _getObjectStore(mode) {

        const transaction = this.DB.transaction(this.table, mode);
        
        transaction.onabort = () => {
            throw new Error("transaction aborted..");
        };
        
        transaction.onerror = () => {
            throw new Error("transaction error..");
        };

        return transaction.objectStore(this.table);
    }

    /**
     * @returns {Array<Object>}
     */
    async _generateResult(){
        const { condition }  = this.Query;
        const collection = [];

        await this._iterate(cursor => {
            let item = {};
            
            // select
            if(this.Query.fields){
                this.Query.fields.forEach(field => {
                    item[field] = cursor.value[field];
                });
            }else{
                item = cursor.value;
            }

            if(condition){
                if (this._valid(cursor.value)) {
                    collection.push({ pk: cursor.primaryKey,  item});
                }
            }else{
                collection.push({ pk: cursor.primaryKey,  item});
            }
        });

        return collection;
    }
    
    /**
     * @private
     * @param {Object} condition 
     */
    _formatCondition(condition){
        const convert = {};
        //轉換key格式為"[field][space][op]"
        for (const [cond, val] of Object.entries(condition)) {
            let [field, op] = cond.split(/\s+/);
            
            if(!op){
                op = "=";
            }

            // where in
            if(Array.isArray(val)){
                op = "in";
            }

            const newCond = field + " " + op;

            convert[newCond] = val;
        }

        return convert;
    }

    /**
     * condition validate
     * @private
     * @param {Object} item 
     * 
     * @returns {Boolean}
     */
    _valid(item){

        const verify = {
            ">": (value, target) => value > target,
            "<": (value, target) => value < target,
            ">=": (value, target) => value >= target,
            "<=": (value, target) => value <= target,
            "=": (value, target) => value === target,
            "like": (value, target) => String(value).includes(target),
            "in": (value, target) => target.includes(value),
        }

        for (const [cond, val] of Object.entries(this.Query.condition)) {

            const [field, op] = cond.split(/\s+/);

            if(!verify[op](item[field], val)){
                return false;
            }
        }

        return true;
          
    }

    /**
     * iterate objectstore
     * @private
     * @callback handle 
     */
    _iterate(handle) {
        return new Promise(resolve => {
            const store = this._getObjectStore(HDB.READONLY);
      
            store.openCursor().onsuccess = async (event) => {
                const cursor = event.target.result;
            
                if (cursor) {
                    await handle(cursor);
                    cursor.continue();
                }else{
                    resolve(true);
                }
            };
        }); 
    }

    /**
     * initialize Query
     * @private
     */
    _queryInit(){
        this.Query = {};
    }

    /**
     * @private
     * @param {Object} el 
     */
    _updatePromise(el){
        return new Promise((resolve, reject) => {
            
            const store = this._getObjectStore(HDB.READWRITE);
        
            const updatePair = this.Query.updatePair;
            const newItem = {...el.item, ...updatePair};

            const action = store.put(newItem);
          
            action.onsuccess = () => {
                resolve(true);
            };
          
            action.onerror = () => {
                reject(false);
            };
        });
    }

    /**
     * @private
     * @param {String|Number} pk 
     */
    _deletePromise(pk){
        return new Promise((resolve, reject) => {
            const store = this._getObjectStore(HDB.READWRITE);
        
            pk = NumberHelper.parse(pk);
            const action = store.delete(pk);
          
            action.onsuccess = () => {
                resolve(true);
            };
          
            action.onerror = () => {
                reject(false);
            };
        });
    }
}

class NumberHelper {
    /**
     * 是否為數字
     * @param {string|number} val
     * @return {boolean}
     */
    static isNumber(val){
        return !isNaN(val) && isFinite(val);
    }

    /**
     * 是否為整數
     * @param {string|number} val
     * @return {boolean}
     */
    static isInteger(val){
        if(!NumberHelper.isNumber(val)){
            return false;
        }

        return Number.isInteger(Number.parseFloat(val));
    }

    /**
     * 是否為大於等於0之整數
     * @param {string|number} val
     * @return {boolean}
     */
    static isNatural(val){
        if(!NumberHelper.isInteger(val)){
            return false;
        }

        return Number.parseInt(val) >= 0;
    }

    /**
     * 若是整數字串，回傳整數；若是浮點數字串，回傳浮點數
     * 
     * @param {string} val 
     * @returns {number|NaN}
     */
    static parse(val){
        if(NumberHelper.isNumber(val)){
            return NumberHelper.isInteger(val)?Number.parseInt(val):Number.parseFloat(val);
        }

        return Number.NaN;
    }
}

class DateHelper {
    /**
     * 是否為合法日期
     * @param {string} str
     * @return {boolean}
     */
    static isDate(str){
        return !isNaN(Date.parse(str));
    }
}