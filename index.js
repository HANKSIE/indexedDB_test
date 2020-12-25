var STORE_NAME = "users";
var dbRequest = indexedDB.open(STORE_NAME);
var DB;

dbRequest.onerror = function (event) {
  alert("Database error");
};

dbRequest.onsuccess = async function (event) {
  DB = dbRequest.result;

  console.log("success");
  DB.onerror = function (event) {
    alert("Database error: " + event.target.errorCode);
  };

  //transaction here
  // removeAll();
  // seedRun();
};

dbRequest.onupgradeneeded = function (event) {
  DB = event.currentTarget.result;
  console.log("upgrade");
  var store = DB.createObjectStore(STORE_NAME, {
    keyPath: "id",
    autoIncrement: true,
  });
  store.createIndex("age", "age", { unique: false });
  store.createIndex("name", "name", { unique: false });
  store.createIndex("id", "id", { unique: true });
};

function getObjectStore(store_name, mode) {
  var transaction = DB.transaction(store_name, mode);

  transaction.onabort = function (event) {
    console.error("transaction aborted..");
  };

  transaction.onerror = function (event) {
    console.error("transaction error..");
  };
  return transaction.objectStore(store_name);
}

function find(id) {
  return new Promise(function(resolve, reject){
    var store = getObjectStore(STORE_NAME, "readonly");

    var action = store.get(id);
  
    action.onsuccess = function () {
      resolve(action.result);
    };
  
    action.onerror = function () {
      reject(false);
    };
  });
}

function count() {
  return new Promise(function(resolve, reject){
    var store = getObjectStore(STORE_NAME, "readonly");

    var action = store.count();
  
    action.onsuccess = function () {
      resolve(action.result);
    };
  
    action.onerror = function () {
      reject(new Error("count fail"));
    };
  }) 
}

function add(data) {
  return new Promise(function(resolve, reject){
    var store = getObjectStore(STORE_NAME, "readwrite");

    var action = store.add(data);
  
    action.onsuccess = function (event) {
      resolve(true);
    };
  
    action.onerror = function (event) {
      reject(false);
    };
  })
 
}

function remove(id) {
  return new Promise(function(resolve, reject){
    var store = getObjectStore(STORE_NAME, "readwrite");

    var action = store.delete(id);
  
    action.onsuccess = function (event) {
      resolve(true);
    };
  
    action.onerror = function (event) {
      reject(false);
    };
  });
 
}

function removeAll() {
  return new Promise(function(resolve, reject){
    var store = getObjectStore(STORE_NAME, "readwrite");

    var action = store.clear();
  
    action.onsuccess = function () {
      resolve(true);
    };
  
    action.onerror = function () {
      reject(false);
    };
  });
 
}

function getAll() {
  var collection = [];
  return new Promise(function(resolve, reject){
    var store = getObjectStore(STORE_NAME, "readonly");

    store.openCursor().onsuccess = function (event) {
      var cursor = event.target.result;
  
      if (cursor) {
        collection.push(cursor.value)
        cursor.continue();
      }else{
        resolve(collection);
      }
    };
  });
}

function search(field, target) {
  var keys = [];
  return new Promise(function(resolve){
    var store = getObjectStore(STORE_NAME, "readonly");
    var index = store.index(field);

    index.openKeyCursor().onsuccess = async function (event) {
      var cursor = event.target.result;

      if (cursor) {
        if (cursor.key.toString().includes(target)) {
          keys.push(cursor.primaryKey);
        }
        cursor.continue();
      }else{
        var collection = [];
        keys.forEach(async function(id){
          collection.push(await find(id));
        })
        resolve(collection);
      }
    };
  });
}

function seedRun() {
  return new Promise( function(resolve, reject){
    var data = [
      { name: "hank hsieh", age: 22 },
      { name: "gary dou", age: 22 },
      { name: "tshou chen lee", age: 22 },
      { name: "stephen curry", age: 30 },
      { name: "klay thompson", age: 33 },
    ];

    data.forEach(async (item) => {
      await add(item);
    });

    resolve(true);
  });
 
}