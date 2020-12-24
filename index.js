var STORE_NAME = "users";
var dbRequest = indexedDB.open(STORE_NAME);
var DB;

dbRequest.onerror = function (event) {
  alert("Database error");
};

dbRequest.onsuccess = function (event) {
  DB = dbRequest.result;

  DB.onerror = function (event) {
    alert("Database error: " + event.target.errorCode);
  };

  //transaction here
  seedRun();
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
  transaction.oncomplete = function (event) {
    console.log("done");
  };

  transaction.onabort = function (event) {
    console.error("action aborted..");
  };

  transaction.onerror = function (event) {
    console.error("action error..");
  };
  return transaction.objectStore(store_name);
}

function find(id) {
  var store = getObjectStore(STORE_NAME, "readonly");

  var action = store.get(id);

  action.onsuccess = function (event) {
    console.log(action.result);
  };

  action.onerror = function (event) {
    console.error("read fail");
  };
}

function count() {
  var store = getObjectStore(STORE_NAME, "readonly");

  var action = store.count();

  action.onsuccess = function (event) {
    console.log(action.result);
  };

  action.onerror = function (event) {
    console.error("read fail");
  };
}

function add(data) {
  var store = getObjectStore(STORE_NAME, "readwrite");

  var action = store.add(data);

  action.onsuccess = function (event) {
    console.log(action.result);
  };

  action.onerror = function (event) {
    console.error("read fail");
  };
}

function remove(id) {
  var store = getObjectStore(STORE_NAME, "readwrite");

  var action = store.delete(id);

  action.onsuccess = function (event) {
    console.log(action.result);
  };

  action.onerror = function (event) {
    console.error("read fail");
  };
}

function removeAll() {
  var store = getObjectStore(STORE_NAME, "readwrite");

  var action = store.clear();

  action.onsuccess = function (event) {
    console.log(action.result);
  };

  action.onerror = function (event) {
    console.error("read fail");
  };
}

function readAll() {
  var store = getObjectStore(STORE_NAME, "readonly");

  store.openCursor().onsuccess = function (event) {
    var cursor = event.target.result;

    if (cursor) {
      console.log(cursor.value);
      cursor.continue();
    }
  };
}

function search(field, target) {
  var store = getObjectStore(STORE_NAME, "readonly");
  var index = store.index(field);

  index.openKeyCursor().onsuccess = function (event) {
    var cursor = event.target.result;

    if (cursor) {
      if (cursor.key.toString().includes(target)) {
        console.log(find(cursor.primaryKey));
      }
      cursor.continue();
    }
  };
}

function seedRun() {
  var data = [
    { name: "hank hsieh", age: 22 },
    { name: "gary dou", age: 22 },
    { name: "tshou chen lee", age: 22 },
    { name: "stephen curry", age: 30 },
    { name: "klay thompson", age: 33 },
  ];
  //transaction here
  // removeAll();
  data.forEach((item) => {
    add(item);
  });
}
