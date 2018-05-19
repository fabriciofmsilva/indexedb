// configuração do banco encapsuladas no módulo
const dbConfig = {
  name: 'default',
  version: 1,
  stores: new Map(), 
  conn: null
};

export const activeRecord = async ({ name, version, mappers }) => {
  // passou as configurações para o objeto dbConfig
  dbConfig.version = version;
  dbConfig.name = name;
  // processa a lista de mappers
  mappers.forEach(mapper => {
    dbConfig.stores.set(mapper.clazz.name, mapper.converter);
      // Adiciona save ao proprotype da classe para 
      // que esteja disponível em todas as instâncias
      // da classe.
      mapper.clazz.prototype.save = save;
      // Adiciona list diretamente na classe como método estático
      mapper.clazz.list = list;
  });

  // awaitter na função createConnection
  await createConnection();
};

const createConnection = () => {
  new Promise((resolve, reject) => {
    // requisitamos a abertura, um evento assíncrono!
    const request = indexedDB.open(dbConfig.name, dbConfig.version);

    request.onupgradeneeded = e => {
      const transactionalConn = e.target.result;
      // utilizando for...of e destructuring ao mesmo tempo
      // para ter acesso facilitado à key do Map
      for (let [classKey] of dbConfig.stores) {
        const store = classKey;
        // se já existe, apagamos a store
        if (transactionalConn.objectStoreNames.contains(store))
          transactionalConn.deleteObject(store);
        transactionalConn.createObjectStore(store, { autoIncrement: true });
      }
    };

    request.onsuccess = e => {
      dbConfig.conn = e.target.result; // guarda uma referência para a conexão
      resolve(); // tudo certo, resolve a Promise!
    };
    // lida com erros, retornando uma mensagem de alto nível
    request.onerror = e => {
      console.log(e.target.error);
      reject('Não foi possível obter a conexão com o banco');
    };
  });
};

const list = async () => {
  return new Promise((reject, resolve) => {
    const store = this.name;
    const transaction = dbConfig.conn
      .transaction([store], 'readwrite')
      .objectStore(store);
    const cursor = transaction.openCursor();
    const converter = dbConfig.stores.get(store);
    const list = [];

    cursor.onsuccess = e => {
      const current = e.target.result;
      if (current) {
        list.push(converter(current.value));
        current.continue();
      } else resolve(list);
    };

    cursor.onerror = e => {
      console.log(e.target.error);
      reject(`Não foi possível lista os dados da store ${store}.`);
    };
  });
};

const save = async () => {
  return new Promise((resolve, reject) => {
    if (!dbConfig.conn) return reject('Você precisa registrar o banco antes de utilizá-lo');

    const object = this;
    const store = this.constructor.name;

    const request = dbConfig.conn
      .transaction([store], 'readwrite')
      .objectStore(store)
      .add(object);

      request.onsuccess = () => resolve();

      request.onerror = e => {
        console.log(e.target.error);
        reject('Não foi possível persistir o objeto');
      };
  });
};
