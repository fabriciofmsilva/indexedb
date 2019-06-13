let dbName = 'default';
let dbVersion = 1;
let conn = null;
const stores = new Map(); 

const createConnection = () => 
  new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onupgradeneeded = e => {
      const transactionalConn = e.target.result;
      for (let [key, value] of stores) {
        const store = key;
        if (transactionalConn.objectStoreNames.contains(store)) 
          transactionalConn.deleteObjectStore(store);
        transactionalConn.createObjectStore(store, { autoIncrement: true });
      }
    };

    request.onsuccess = e => {
      conn = e.target.result;
      resolve();
    };

    request.onerror = e => {
      console.log(e.target.error);
      reject('Não foi possível obter a conexão com o banco');
    };
  });

class Manager {
  setDbName(name) {
    dbName = name;
    return this; 
  }

  setDbVersion(version) {
    dbVersion = version;
    return this; 
  }

  async register(...mappers) {
    mappers.forEach(mapper =>
      stores.set(
        mapper.clazz.name,
        mapper.converter
      )
    );
    await createConnection();
  }

  save(object) {
    return new Promise((resolve, reject) => {
      // falhando rapidamente, "fail fast"
      if(!conn) return reject('Você precisa registrar o banco antes de utilizá-lo');
      
      // obtem o nome da store através do nome da classe
      const store = object.constructor.name;
      
      const request = conn
        .transaction([store],"readwrite")
        .objectStore(store)
        .add(object);
      
      // resolve a Promise no sucesso
      request.onsuccess = () => resolve();

      request.onerror = e => {
        console.log(e.target.error);
        reject('Não foi possível persistir o objeto');
      };
    });
  }

  list(clazz) {
    return new Promise((resolve, reject) => {
      // Identifica a store
      const store = clazz.name;
      // Cria uma transação de escrita
      const transaction = conn
        .transaction([store],'readwrite')
        .objectStore(store); 
      
      const cursor = transaction.openCursor();
      // Converter da store
      const converter = stores.get(store);
      // Array que receberá os dados convertidos
      // com auxílio do nosso converter
      const list = [];
      // Será chamado uma vez para cada 
      // objeto armazenado no banco
      cursor.onsuccess = e => {
        const current = e.target.result;
        // Se for null, não há mais dados
        if(current) {
          list.push(converter(current.value));
          // vai para o próximo registro
          current.continue();
        } else resolve(list);
      };

      cursor.onerror = e => {
        console.log(target.error);
        reject(`Não foi possível lista os dados da store ${store}.`);
      };  
    });  
  }
}

export const manager = new Manager();
