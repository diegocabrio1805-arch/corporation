console.log("Inyectando script para extraer usuarios directo de la memoria de React...");

setTimeout(() => {
    try {
        const req = indexedDB.open("localforage");
        req.onsuccess = function (e) {
            const db = e.target.result;
            const transaction = db.transaction("keyvaluepairs", "readonly");
            const store = transaction.objectStore("keyvaluepairs");
            const getReq = store.get("persist:root");

            getReq.onsuccess = function () {
                if (getReq.result) {
                    const stateStr = JSON.parse(getReq.result);
                    const users = JSON.parse(stateStr.users || '[]');

                    console.log("=== USUARIOS EN CACHE DE LA APP ===");
                    users.forEach(u => console.log(`[${u.id}] Nombre: ${u.name}`));

                    // Buscar Derlis
                    const derlisUser = users.find(u => u.name && u.name.toUpperCase().includes('DERLIS'));
                    if (derlisUser) {
                        console.log(`\n -> DERLIS ENCONTRADO EN CACHÉ. ID: ${derlisUser.id}`);

                        // Ver sus clientes asignados actualmente en caché
                        const clients = JSON.parse(stateStr.clients || '[]');
                        const sysClients = clients.filter(c => c.branchId === derlisUser.id && !c.deletedAt);
                        console.log(` -> Clientes mapeados a su ID en la caché de este PC: ${sysClients.length}`);
                    }
                }
            };
        };
    } catch (e) {
        console.error("Error leyendo IndexedDB", e);
    }
}, 3000);
