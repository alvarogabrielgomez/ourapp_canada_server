const config = require('config');
const mongoose = require('mongoose');
const helmet = require('helmet');
const Joi = require('joi');
const express = require('express');
const cors = require('cors');
const index = require('./routes/index');
var CuentaFija = require('./models/CuentaFija');
var PagoCuentaFija = require('./models/PagoCuentaFija');

var admin = require("firebase-admin");
// var serviceAccount = require("./firebase-credentials.json");
admin.initializeApp({
    credential: admin.credential.cert({
        "type": process.env.FIREBASE_TYPE,
        "project_id": process.env.FIREBASE_PROJECT_ID,
        "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
        "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        "client_email": process.env.FIREBASE_CLIENT_EMAIL,
        "client_id": process.env.FIREBASE_CLIENT_ID,
        "auth_uri": process.env.FIREBASE_AUTH_URI,
        "token_uri": process.env.FIREBASE_TOKEN_URI,
        "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
    }),
    // credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ourapp-ec834.firebaseio.com"
});
const db = admin.firestore();

const {
    get
} = require('config');
const {
    diff
} = require('semver');
const app = express();
app.use(cors({
    origin: true
}));
app.set('view engine', 'ejs');

// console.log(`NODE_ENV IS ${process.env.NODE_ENV}`);
console.log(`App Name: ${config.get('name')}`);
console.log(`Package Name: ${process.env.npm_package_name}`);
console.log(`Mail Server: ${config.get('mail.host')}`);
// console.log(`Mail password: ${config.get('mail.password')}`);
console.log(`App mode: ${app.get('env')}`);


class RestResponse {
    constructor(message, success, value) {
        this.message = message,
            this.success = success,
            this.value = value
    }
    ok(valueok) {
        return new RestResponse("", true, valueok);
    }
    okMessage(messageok, valueok) {
        return new RestResponse(messageok, true, valueok);
    }
    badRequest(messagebadrequest) {
        return new RestResponse(messagebadrequest, false);
    }
    serverError(messageServerError) {
        return new RestResponse(messageServerError, false);
    }
}


app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(helmet()); // Sending various http headers
app.use('/', index); // index
// app.use('/api', api); // api shit

app.get('/api/authors', (req, res) => {
    (async () => {
        try {
            let query = db.collection('Authors');
            let authors = [];
            await query.get().then(data => {
                let docs = data.docs;
                for (let doc of docs) {
                    const selectedItem = {
                        id: doc.id,
                        name: doc.data().name,
                    };
                    authors.push(selectedItem);
                }
            });
            return res.status(200).send(new RestResponse().ok(authors));
        } catch (err) {
            console.log("Error /api/authors", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

app.get('/api/typePurchases', (req, res) => {
    (async () => {
        try {
            let query = db.collection('TypePurchase');
            let typePurchases = [];
            await query.get().then(data => {
                let docs = data.docs;
                for (let doc of docs) {
                    const selectedItem = {
                        id: doc.id,
                        name: doc.data().name,
                    };
                    typePurchases.push(selectedItem);
                }
            });
            return res.status(200).send(new RestResponse().ok(typePurchases));
        } catch (err) {
            console.log("Error /api/typePurchases", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});


//////////////////purchases
// new item
app.post('/api/newPurchase', (req, res) => {
    const newPurchase = {
        types: req.body.types,
        author: req.body.author,
        value: parseFloat(req.body.value),
        description: req.body.description,
        date: getDateNow()
    };
    (async () => {
        try {
            var newPurchaseResponse = await db.collection('Purchases').doc()
                .set(newPurchase);
            return res.status(200).send(new RestResponse().okMessage("Guardado con exito!", newPurchase));
        } catch (err) {
            console.log("Error /api/newPurchase", error);
            return res.status(500).send(new RestResponse().serverError("Error al guardar"));
        }
    })();
});

// read all items current month

app.get('/api/purchasesCurrentMonth', (req, res) => {
    (async () => {
        try {
            let now = Date.now();
            now = new Date(now);
            let currentMonth = new Date(now.getFullYear(), now.getMonth() - 1, 0);

            let query = db.collection('Purchases')
                .where("date", ">", currentMonth)
                .orderBy('date', 'desc');
            let purchases = [];

            await query.get().then(data => {
                let docs = data.docs;
                docs.forEach(doc => {
                    var time = doc.data().date;
                    var date = time.toDate();
                    const selectedItem = {
                        id: doc.id,
                        description: doc.data().description,
                        author: doc.data().author,
                        value: doc.data().value,
                        types: doc.data().types,
                        date: date,
                    };
                    purchases.push(selectedItem);
                });
            });

            return res.status(200).send(new RestResponse().ok(purchases));
        } catch (err) {
            console.log("Error /api/purchasesCurrentMonth", err);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});


app.get('/api/v2/purchasesCurrentMonth', (req, res) => {
    (async () => {
        try {
            let now = Date.now();
            now = new Date(now);
            let currentMonth = new Date(now.getFullYear(), now.getMonth() - 1, 0);

            let query = db.collection('Purchases')
                .where("date", ">", currentMonth)
                .orderBy('date', 'desc');
            let purchases = [];
            let valorTotalCompras = 0.00;
            let valorTotalSupermercado = 0.00;
            await query.get().then(data => {
                let docs = data.docs;
                docs.forEach(doc => {
                    var time = doc.data().date;
                    var date = time.toDate();
                    var timeUpdate = doc.data().updateDate;
                    var updateDate = timeUpdate ? timeUpdate.toDate() : date;
                    const selectedItem = {
                        id: doc.id,
                        description: doc.data().description,
                        author: doc.data().author,
                        value: doc.data().value,
                        types: doc.data().types,
                        date: date,
                        updateDate: updateDate
                    };
                    purchases.push(selectedItem);
                });
            });

            purchases.forEach(x => {
                if (x.types.includes("Supermercado")) {
                    valorTotalSupermercado += parseFloat(x.value);
                } else {
                    valorTotalCompras += parseFloat(x.value);
                }
            })

            const responsePurchase = {
                purchases: purchases,
                valorTotalCompras: parseFloat(valorTotalCompras.toFixed(2)),
                valorTotalSupermercado: parseFloat(valorTotalSupermercado.toFixed(2)),
            };
            return res.status(200).send(new RestResponse().ok(responsePurchase));
        } catch (err) {
            console.log("Error /api/purchasesCurrentMonth", err);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

// read all items 
app.get('/api/purchases', (req, res) => {
    (async () => {
        try {
            let query = db.collection('Purchases').orderBy('date', 'desc');
            let purchases = [];
            let valorTotalCompras = 0.00;
            let valorTotalSupermercado = 0.00;
            await query.get().then(data => {
                let docs = data.docs;

                docs.forEach(doc => {
                    var time = doc.data().date;
                    var date = time.toDate();
                    const selectedItem = {
                        id: doc.id,
                        description: doc.data().description,
                        author: doc.data().author,
                        value: doc.data().value,
                        types: doc.data().types,
                        date: date,
                    };
                    purchases.push(selectedItem);
                });
            });

            purchases.forEach(x => {
                if (x.types.includes("Supermercado")) {
                    valorTotalSupermercado += parseFloat(x.value);
                } else {
                    valorTotalCompras += parseFloat(x.value);
                }
            })

            const responsePurchase = {
                purchases: purchases,
                valorTotalCompras: parseFloat(valorTotalCompras.toFixed(2)),
                valorTotalSupermercado: parseFloat(valorTotalSupermercado.toFixed(2)),
            };

            return res.status(200).send(new RestResponse().ok(responsePurchase));
        } catch (err) {
            console.log("Error /api/purchases", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

// read item
app.get('/api/purchases/:item_id', (req, res) => {
    (async () => {
        try {
            const document = db.collection('Purchases').doc(req.params.item_id);
            let doc = await document.get();
            var time = doc.data().date;
            var date = time.toDate();
            const selectedItem = {
                id: doc.id,
                description: doc.data().description,
                author: doc.data().author,
                value: doc.data().value,
                types: doc.data().types,
                date: date,
            };
            return res.status(200).send(new RestResponse().ok(selectedItem));
        } catch (error) {
            console.log("Error /api/purchases/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

// delete item
app.delete('/api/purchases/:item_id', (req, res) => {
    (async () => {
        try {
            const document = db.collection('Purchases').doc(req.params.item_id);
            await document.delete();
            return res.status(200).send(new RestResponse().ok("deleted"));
        } catch (error) {
            console.log("Error delete /api/purchases/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al borrar de la database"));
        }
    })();
});

// update item
app.put('/api/purchases/:item_id', (req, res) => {
    (async () => {
        const putPurchase = {
            types: req.body.types,
            updateAuthor: req.body.author,
            value: parseFloat(req.body.value),
            description: req.body.description,
            updateDate: getDateNow(),
            date: admin.firestore.Timestamp.fromDate(new Date(req.body.date)),
        };

        try {
            const document = db.collection('Purchases').doc(req.params.item_id);
            await document.update(putPurchase);
            return res.status(200).send(new RestResponse().ok("updated"));
        } catch (error) {
            console.log("Error update /api/purchases/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al actualizar de la database"));
        }
    })();
});


//////////////////// cuentasFijas
//new item
app.post('/api/newCuentaFija', (req, res) => {
    (async () => {
        var incrementValues = {
            sign: "zero",
            value: 0
        }
        const dateNow = getDateNow();
        var newCuentaFija = new CuentaFija(
            null, // EL id lo define el servidor
            req.body.name,
            req.body.description,
            req.body.value,
            incrementValues,
            req.body.dayOfPayment,
            dateNow,
            dateNow,
        );
        if (req.body.id && req.body.id != "") newCuentaFija.id = req.body.id;

        var newPagoCuentaFija = new PagoCuentaFija(
            null,
            "idcuentafija",
            req.body.value,
            incrementValues,
            dateNow,
            dateNow,
        );
        try {
            var newCuentaFijaResponse = await newCuentaFija.create(db);
            newPagoCuentaFija.idCuentaFija = newCuentaFijaResponse.id;
            await newPagoCuentaFija.create(db);
            return res.status(200).send(new RestResponse().okMessage("Guardado con exito!"));
        } catch (err) {
            console.log("Error /api/newCuentaFija", err);
            return res.status(500).send(new RestResponse().serverError("Error al guardar"));
        }
    })();
});

// update item
app.put('/api/cuentasFijas/:item_id', (req, res) => {
    (async () => {
        const putCuentaFija = {
            name: req.body.name,
            description: req.body.description,
            value: parseFloat(req.body.value),
            date: admin.firestore.Timestamp.fromDate(new Date(req.body.date)),
            updateDate: getDateNow()
        };

        try {
            const document = db.collection('CuentasFijas').doc(req.params.item_id);
            await document.update(putCuentaFija);
            return res.status(200).send(new RestResponse().ok("updated"));
        } catch (error) {
            console.log("Error update /api/cuentasFijas/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al actualizar de la database"));
        }
    })();
});

// read all items
app.get('/api/cuentasFijas', (req, res) => {
    (async () => {
        try {
            let query = db.collection('CuentasFijas').orderBy('date', 'desc');
            let cuentasFijas = [];
            await query.get().then(data => {
                let docs = data.docs;
                docs.forEach(doc => {
                    var time = doc.data().date;
                    var date = time.toDate();
                    var timeUpdate = doc.data().updateDate;
                    var updateDate = timeUpdate.toDate();
                    const selectedItem = {
                        id: doc.id,
                        name: doc.data().name,
                        description: doc.data().description,
                        value: doc.data().value,
                        increment: doc.data().increment,
                        dayOfPayment: doc.data().dayOfPayment,
                        date: date,
                        updateDate: updateDate,
                    };
                    cuentasFijas.push(selectedItem);
                });
            });
            return res.status(200).send(new RestResponse().ok(cuentasFijas));
        } catch (err) {
            console.log("Error /api/cuentasFijas", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

// read item
app.get('/api/cuentasFijas/:item_id', (req, res) => {
    (async () => {
        try {

            let doc = await CuentaFija.fetch(db, req.params.item_id);
            var time = doc.data().date;
            var date = time.toDate();
            var timeUpdate = doc.data().updateDate;
            var updateDate = timeUpdate.toDate();
            const selectedItem = {
                id: doc.id,
                name: doc.data().name,
                description: doc.data().description,
                value: doc.data().value,
                increment: doc.data().increment,
                dayOfPayment: doc.data().dayOfPayment,
                date: date,
                updateDate: updateDate,
            };
            return res.status(200).send(new RestResponse().ok(selectedItem));
        } catch (error) {
            console.log("Error /api/cuentasFijas/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

// delete item
app.delete('/api/cuentasFijas/:item_id', (req, res) => {
    (async () => {
        try {
            const document = db.collection('CuentasFijas').doc(req.params.item_id);
            await document.delete();
            return res.status(200).send(new RestResponse().ok("deleted"));
        } catch (error) {
            console.log("Error delete /api/cuentasFijas/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});




/////////////////  pagosCuentasFijas
// new item
app.post('/api/newPagoCuentaFija', (req, res) => {

    (async () => {
        try {
            var incrementValues = await getIncrementValueOfCuentasFijas(req.body.idCuentaFija, req.body.value);
            const dateNow = getDateNow();
            const datePago = admin.firestore.Timestamp.fromDate(new Date(req.body.date));
            var newPagoCuentaFija = new PagoCuentaFija(
                null,
                req.body.idCuentaFija,
                req.body.value,
                incrementValues,
                datePago, // date pago
                dateNow // update date
            );
            await newPagoCuentaFija.create(db);

            await db.collection("CuentasFijas").doc(req.body.idCuentaFija).update({
                value: req.body.value,
                increment: incrementValues,
                updateDate: dateNow // update date
            });

            return res.status(200).send(new RestResponse().okMessage("Guardado con exito!"));
        } catch (err) {
            console.log("Error /api/newPagoCuentaFija", err);
            return res.status(500).send(new RestResponse().serverError("Error al guardar"));
        }
    })();
});

// update item
app.put('/api/pagosCuentasFijas/:item_id', (req, res) => {
    (async () => {
        const putPagoCuentaFija = {
            idCuentaFija: req.body.idCuentaFija,
            value: parseFloat(req.body.value),
            date: admin.firestore.Timestamp.fromDate(new Date(req.body.date)),
            updateDate: getDateNow()
        };

        try {
            const document = db.collection('PagosCuentasFijas').doc(req.params.item_id);
            await document.update(putPagoCuentaFija);
            return res.status(200).send(new RestResponse().ok("updated"));
        } catch (error) {
            console.log("Error update /api/pagosCuentasFijas/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al actualizar de la database"));
        }
    })();
});

// read all item
app.get('/api/pagosCuentasFijas', (req, res) => {
    (async () => {
        try {
            let query = db.collection('PagosCuentasFijas').orderBy('date', 'desc');
            let pagosCuentasFijas = [];
            await query.get().then(data => {
                let docs = data.docs;
                docs.forEach(doc => {
                    var time = doc.data().date;
                    var date = time.toDate();

                    var timeUpdate = doc.data().updateDate;
                    var updateDate = timeUpdate.toDate();

                    const selectedItem = {
                        id: doc.id,
                        idCuentaFija: doc.data().idCuentaFija,
                        value: doc.data().value,
                        increment: doc.data().increment,
                        date: date,
                        updateDate: updateDate,
                    };
                    pagosCuentasFijas.push(selectedItem);
                });
            });
            return res.status(200).send(new RestResponse().ok(pagosCuentasFijas));
        } catch (err) {
            console.log("Error /api/pagosCuentasFijas", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

// read all where idCuentaFija
app.get('/api/pagosCuentasFijas/cuentaFija/:id_cuenta_fija', (req, res) => {
    (async () => {
        try {
            let query = db.collection('PagosCuentasFijas').where("idCuentaFija", "==", req.params.id_cuenta_fija).orderBy('date', 'desc');
            let pagosCuentasFijas = [];
            await query.get().then(data => {
                let docs = data.docs;
                docs.forEach(doc => {
                    var time = doc.data().date;
                    var date = time.toDate();

                    var timeUpdate = doc.data().updateDate;
                    var updateDate = timeUpdate.toDate();

                    const selectedItem = {
                        id: doc.id,
                        idCuentaFija: doc.data().idCuentaFija,
                        value: doc.data().value,
                        increment: doc.data().increment,
                        date: date,
                        updateDate: updateDate,
                    };
                    pagosCuentasFijas.push(selectedItem);
                });
            });
            return res.status(200).send(new RestResponse().ok(pagosCuentasFijas));
        } catch (err) {
            console.log("Error /api/pagosCuentasFijas", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});


// read item
app.get('/api/pagosCuentasFijas/:item_id', (req, res) => {
    (async () => {
        try {
            const document = db.collection('PagosCuentasFijas').doc(req.params.item_id);
            let doc = await document.get();

            var time = doc.data().date;
            var date = time.toDate();

            var timeUpdate = doc.data().updateDate;
            var updateDate = timeUpdate.toDate();

            const selectedItem = {
                id: doc.id,
                idCuentaFija: doc.data().idCuentaFija,
                value: doc.data().value,
                increment: doc.data().increment,
                date: date,
                updateDate: updateDate,
            };
            return res.status(200).send(new RestResponse().ok(selectedItem));
        } catch (error) {
            console.log("Error /api/pagosCuentasFijas/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});

// delete item
app.delete('/api/pagosCuentasFijas/:item_id', (req, res) => {
    (async () => {
        try {
            const document = db.collection('PagosCuentasFijas').doc(req.params.item_id);
            await document.delete();
            return res.status(200).send(new RestResponse().ok("deleted"));
        } catch (error) {
            console.log("Error delete /api/pagosCuentasFijas/:item_id", error);
            return res.status(500).send(new RestResponse().serverError("Error al leer de la database"));
        }
    })();
});


function getDateNow() {
    var date = admin.firestore.Timestamp.fromDate(new Date());
    return date;
}

async function getIncrementValueOfCuentasFijas(idCuentaFija, actualValue) {
    var incrementValue = {
        sign: "",
        value: 0
    };
    try {
        const document = db.collection('CuentasFijas').doc(idCuentaFija);

        var response = await document.get();
        var lastValue = 0.00;

        lastValue = parseFloat(parseFloat(response.data().value).toFixed(2));

        var diffValue = parseFloat(parseFloat(parseFloat(actualValue.toFixed(2)) - lastValue).toFixed(2));
        var signValue = Math.sign(diffValue) == 0 ? "zero" : Math.sign(diffValue) > 0 ? "positive" : "negative";
        incrementValue.sign = signValue;
        incrementValue.value = Math.abs(diffValue);

        return incrementValue;
    } catch (error) {
        console.log("Error getIncrementValueOfCuentasFijas", error);
        return incrementValue;
    }
}


app.use(express.static('public'));

console.log("After");

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));