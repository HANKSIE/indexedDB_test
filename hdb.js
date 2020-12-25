/**
 * @class HDB
 * 
 * @description Query Builder for IndexedDB
 */

class HDB {

    /**
     * @constant
     */
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
     * @param {String} database database name
     * @param {String} table table name
     * @param {object} config configuration of table
     * 
     * @returns {HDB | Error} 
     */
    constructor(database, table, config = {keyPath: "", autoIncrement: "", indexes: []}){
        this.database = database;
        this.table = table;
        this.config = config;
        this.DB;
        this.Query = {
            fields: undefined,
            condition: undefined,
            orderBy: undefined,
            limit: undefined,
            offset: undefined,
            like: undefined,
            having: undefined,
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
     * @private
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
    insert(item) {
        return new Promise((resolve, reject) => {
            const store = this._getObjectStore(HDB.READWRITE);
      
            const action = store.add(item);
        
            action.onsuccess = () => {
                resolve(true);
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
      
            const action = store.get(pk);
        
            action.onsuccess = () => {
                this._queryInit();
                resolve(action.result);
            };
            
            action.onerror = () => {
                reject(false);
            };
        });
    }
    
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

            // select
            if(this.Query.fields){
                collection = collection.map(item => {
                    const newItem = {};
                    this.Query.fields.forEach(field => {
                        newItem[field] = item[field];
                    });
                    return newItem;
                });
            }
    
        }

        this._queryInit();
        return collection;
    }

    async delete(){
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
     * 
     * @returns {Array<Object>}
     */
    async _generateResult(){
        const { condition }  = this.Query;
        const collection = [];

        await this._iterate(cursor => {
            const item = cursor.value;
            item[cursor.source.keyPath] = cursor.primaryKey;
            if(condition){
                if (this._valid(cursor.value, condition)) {
                    collection.push({ pk: cursor.primaryKey,  item: cursor.value});
                }
            }else{
                collection.push({ pk: cursor.primaryKey,  item: cursor.value});
            }
        });

        return collection;
    }
    
    _formatCondition(condition){
        const convert = {};
        //轉換key格式為"[field][space][op]"
        for (const [cond, val] of Object.entries(condition)) {
            let [field, op] = cond.split(/\s+/);
            
            if(!op){
                op = "=";
            }

            const newCond = field + " " + op;

            convert[newCond] = val;
        }

        return convert;
    }

    /**
     * 
     * @param {Object} item 
     * @param {Object} condition 
     * 
     * @returns {Boolean}
     */
    _valid(item, condition){

        const verify = {
            ">": (value, target) => value > target,
            "<": (value, target) => value < target,
            ">=": (value, target) => value >= target,
            "<=": (value, target) => value <= target,
            "=": (value, target) => value === target,
        }

        for (const [cond, val] of Object.entries(condition)) {

            const [field, op] = cond.split(/\s+/);

            if(!verify[op](item[field], val)){
                return false;
            }
        }

        return true;
          
    }

    /**
     * iterate objectstore
     * 
     * @callback handle 
     */
    _iterate(handle) {
        return new Promise(async resolve => {
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

    _queryInit(){
        this.Query = {};
    }

    _deletePromise(pk){
        return new Promise((resolve, reject) => {
            const store = this._getObjectStore(HDB.READWRITE);
        
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
     * @param {number} val
     * @return {boolean}
     */
    static isNumber(val){
        return !isNaN(val) && isFinite(val);
    }

    /**
     * 是否為整數
     * @param {number} val
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
     * @param {number} val
     * @return {boolean}
     */
    static isNatural(val){
        if(!NumberHelper.isInteger(val)){
            return false;
        }

        return Number.parseInt(val) >= 0;
    }
}

class DateHelper {
    /**
     * 是否為合法日期
     * @param {number} str
     * @return {boolean}
     */
    static isDate(str){
        return !isNaN(Date.parse(str));
    }
}