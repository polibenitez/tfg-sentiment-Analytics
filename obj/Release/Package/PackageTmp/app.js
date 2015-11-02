
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');

var app = express();

var sentiment = require('sentiment');
var twitter = require('ntwitter');

var stream;

var DEFAULT_TOPIC = "UPO";

// En esta variable sguardamos las keys de nuestra app en Twitter
// en la siguiente direcion: https://dev.twitter.com/apps
var tweeter = new twitter({
    consumer_key: 'K2oQuJ4aTPfzB29NJ0owbMwzI',
    consumer_secret: 'KiEqMp7H9yh32UYry5u2d5QJOUVriFjMCbhc6irj2lX4rIBRuK',
    access_token_key: '155300136-h84h96jh7jjQyJdImOHmjlkz7M6u5BGFBPWngfHW',
    access_token_secret: 'Gi0e7nMeoBMly3AOXUpFdnOqWlUg8yqwAKit8jaxlpISf'
});

//variables necessarias para la medicion del sentimiento
var tweetCount = 0;
var tweetTotalSentiment = 0;
var monitoringPhrase;
app.get('/mongo', function (req, res) {
    // Retrieve
    var MongoClient = require('mongodb').MongoClient;
    
    // Connect to the db
    MongoClient.connect("mongodb://localhost:27017/Sentimentweets", function (err, db) {
        if (!err) {
            console.log("We are connected");
            var collection = db.collection('tweets');
            var doc1 = { 'hello': 'doc1' };
            collection.insert(doc1);
            collection.find().toArray(function (err, docs) {
                
                //imprimimos en la consola el resultado
                console.dir(docs);
            });
        }
    });/*
    //=======Mongodb==========
    // hacemos referencia a la dependencia 
    var mongodb = require('mongodb');

    // obtenemos el server MongoDB que dejamos corriendo
    // *** el puerto 27017 es el default de MongoDB
    var server = new mongodb.Server("127.0.0.1", 27017, {});

    // obtenemos la base de datos de prueba que creamos
    var dbTest = new mongodb.Db('Sentimentweets', server, {})
    dbTest.open(function (error, client) {
        if (error) throw error;
    
        //en el parámetro client recibimos el cliente para comenzar a hacer llamadas
        //este parámetro sería lo mismo que hicimos por consola al llamar a mongo
    
        //Obtenemos la coleccion personas que creamos antes
        var collection = new mongodb.Collection('tuit', 'tweets');
    
        //disparamos un query buscando la persona que habiamos insertado por consola
        collection.find().toArray(function (err, docs) {
        
            //imprimimos en la consola el resultado
            console.dir(docs);
        });
    });*/
});
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

//app.get('/', routes.index);
app.get('/about', routes.about);
app.get('/contact', routes.contact);

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});


// atrapamos los errores al parsear el body
process.on('uncaughtException', function (err) {
    console.error('Caught exception: ' + err.stack);
});
process.on("exit", function (code) {
    console.log("exiting with code: " + code);
});


//con esta funcion podemos comprobar que nos podemos logear bien en Twitter
app.get('/twitterCheck', function (req, res) {
    tweeter.verifyCredentials(function (error, data) {
        res.send("Hello, " + data.name + ".  I am in your twitters.");
    });
});


app.get('/sentiment', function (req, res) {
    res.json({
        monitoring: (monitoringPhrase != null), 
        monitoringPhrase: monitoringPhrase, 
        tweetCount: tweetCount, 
        tweetTotalSentiment: tweetTotalSentiment,
        sentimentImageURL: sentimentImage()
    });
});

app.post('/sentiment', function (req, res) {
    try {
        if (req.body.phrase) {
            beginMonitoring(req.body.phrase);
            res.send(200);
        } else {
            res.status(400).send('Invalid request: send {"phrase": "bieber"}');
        }
    } catch (exception) {
        res.status(400).send('Invalid request: send {"phrase": "bieber"}');
    }
});

function resetMonitoring() {
    if (stream) {
        var tempStream = stream;
        stream = null;  // destruimos lo que hemos ido guardando en al cadena de Tweets
        tempStream.destroySilent();
    }
    monitoringPhrase = "";
}

function beginMonitoring(phrase) {
    // funcion para limpiar los contenedores para hacer un nuevo monitoring
    if (monitoringPhrase) {
        resetMonitoring();
    }
    monitoringPhrase = phrase;
    tweetCount = 0;
    tweetTotalSentiment = 0;
    tweeter.verifyCredentials(function (error, data) {
        if (error) {
            resetMonitoring();
            console.error("Error connecting to Twitter: " + error);
            if (error.statusCode === 401) {
                console.error("Authorization failure.  Check your API keys.");
            }
        } else {
            tweeter.stream('statuses/filter', {
                'track': monitoringPhrase
            }, function (inStream) {
                
                stream = inStream;
                console.log("Monitoring Twitter for " + monitoringPhrase);
                stream.on('data', function (data) {
                    // solo se analizan tweets en español o en ingles
                    //console.log(data);
                    if (data.lang === 'en') {
                        sentiment(data.text, { lang: 'en' }, function (err, result) {
                            tweetCount++;
                            tweetTotalSentiment += result.score;
                        });
                    } else if (data.lang === 'es') {
                        sentiment(data.text, { lang: 'es' }, function (err, result) {
                            tweetCount++;
                            tweetTotalSentiment += result.score;
                            console.log(data.text);
                            console.log(result.score + "esto es el resultado");
                        });
                    }
                });
                stream.on('error', function (error, code) {
                    console.error("Error received from tweet stream: " + code);
                    if (code === 420) {
                        console.error("limite de tweets de la API");
                    }
                    resetMonitoring();
                });
                stream.on('end', function (response) {
                    if (stream) {
                        console.error("Stream finalizo ineperadamente, reinicia el monitoreo");
                        resetMonitoring();
                    }
                });
                stream.on('destroy', function (response) {
                    
                    console.error("Stream se paro inesperadamenete sin errores de desde Twitter,reinicia el monitoreo.");
                    resetMonitoring();
                });
            });
            return stream;
        }
    });
}

app.get('/media',
    function (req, res) {
    var array = [[]];
    var avg = tweetTotalSentiment / tweetCount;
    
    /*for (i = 0; i < 3; i++) {
        var aux = Math.floor((Math.random() * 10) + 1);
        var aux1 = Math.floor((Math.random() * 10) + 1);
        var aux2 = [i,aux1];
        array[0].push(aux2);
    }*/
    
    if (!avg) {
        avg = 0;
    }
    //console.log(avg);
    //console.log(array);
    return res.send({ media: avg , ntweet: tweetCount });
    //return res.send({ media: array });

});

function valormedio(){
    var avg = tweetTotalSentiment / tweetCount;
    return avg;
}
function sentimentImage() {
    var avg = tweetTotalSentiment / tweetCount;
    if (avg > 0.4) { // positivo
        return "images/positivo.jpg";
    }
    if (avg < -0.4) { // negativo
        return "images/negativo.png";
    }
    // neutral
    return "images/content.png";
}

app.get('/',
    function (req, res) {
    var welcomeResponse = 
                "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Monitorizar - Trabajo Fin de Grado de Manuel Benítez Sánchez</title>" +
            "<link rel='stylesheet' type='text/css' href='/stylesheets/bootstrap.min.css'><link rel='stylesheet' type='text/css' href='/stylesheets/style.css'>" +
            "<script src='/javascripts/modernizr-2.6.2.js'></script>" +
            "</head>" +
            "<body>" +
            "<div class='navbar navbar-inverse navbar-fixed-top'>" +
            "<div class='container'><div class='navbar-header'>" +
            "<button type='button' data-toggle='collapse' data-target='.navbar-collapse' class='navbar-toggle'><span class='icon-bar'></span>" +
            "<span class='icon-bar'></span>" +
            "<span class='icon-bar'></span>" +
            "</button><a href='/' class='navbar-brand'>Sentiment analytics on Twitter</a></div>" +
            "<div class='navbar-collapse collapse'>" +
            "<ul class='nav navbar-nav'>" +
            "<li><a href='/'>Home</a></li>" +
            "<li><a href='/about'>About</a></li>" +
            "<li><a href='/contact'>Contact</a></li>" +
            "</ul></div>" +
            "</div></div><div class='container body-content'><h3>Página de monitorización y análisis</h3>" +
            "<p>En esta página introducimos la palabra clave o el hashtag que deseemos monitorizar y a su vez análizar con nuestro algoritmo de minería de opinión.<br>Si al ejecutarlo parece que no hace nada, espere un poco, hasta no tener unos cuantos Tweets análizados no se verá el resultado en la gráfica.<div class='container'>" +
            "<div class='page-header'><h1>Sentiment Analytics </h1>" +
            "</div>" +
            "<form method='get' action='/monitor' class='login-form form-horizontal'>" +
            "<input name='phrase' type='hidden'><div class='form-group'><label class='col-sm-4'>Introduce que palabra calve o hashtag desea monitorizar</label><div class='col-sm-8'>" +
            "<input placeholder='Como por ejemplo Siria' required name='phrase' type='text' class='form-control'></div>" +
            "</div><div class='form-group'><div class='col-sm-offset-4 col-sm-8'>" +
            "<button type='submit' class='login btn btn-primary'>Enviar</button></div>" +
            "</div></form></div></p><hr>" +
            "<footer><p>&copy; 2015 - Trabajo Fin de Grado de Manuel Benítez Sánchez</p></footer></div>" +
            "<script src='/javascripts/jquery-1.10.2.js'></script><script src='/javascripts/bootstrap.js'></script>" +
            "<script src='/javascripts/respond.js'></script></body></html>";
    if (!monitoringPhrase) {
        res.send(welcomeResponse);
    } else {
        var monitoringResponse = 
            "<!DOCTYPE html><html><head><META >" +
            "<title>Monitorizar - Trabajo Fin de Grado de Manuel Benítez Sánchez</title>" +
            "<link rel='stylesheet' type='text/css' href='/stylesheets/bootstrap.min.css'><link rel='stylesheet' type='text/css' href='/stylesheets/style.css'>" +
            "<script src='/javascripts/modernizr-2.6.2.js'></script>" +
            "<script src='/javascripts/jquery.js'></script>" +
            "<script src='/javascripts/jquery.flot.js'></script>" +
            "<script src='/javascripts/JavaScript.js'></script>"+
            "</head>" +
            "<body>" +
            "<div class='navbar navbar-inverse navbar-fixed-top'>" +
            "<div class='container'><div class='navbar-header'>" +
            "<button type='button' data-toggle='collapse' data-target='.navbar-collapse' class='navbar-toggle'><span class='icon-bar'></span>" +
            "<span class='icon-bar'></span>" +
            "<span class='icon-bar'></span>" +
            "</button><a href='/' class='navbar-brand'>Sentiment analytics on Twitter</a></div>" +
            "<div class='navbar-collapse collapse'>" +
            "<ul class='nav navbar-nav'>" +
            "<li><a href='/'>Home</a></li>" +
            "<li><a href='/about'>About</a></li>" +
            "<li><a href='/contact'>Contact</a></li>" +
            "</div></div></div><div class='container body-content'><h3>Página de monitorización y análisis</h3>" +
            "<p>En esta página introducimos la palabra clave o el hashtag que deseemos monitorizar y a su vez análizar con nuestro algoritmo de minería de opinión.<br>Si al ejecutarlo parece que no hace nada, espere un poco, hasta no tener unos cuantos Tweets análizados no se verá el resultado en la gráfica.<div class='container'>" +
            "<div class='page-header'><h1>Sentiment Analytics </h1>" +
            "</div>" +
            "<p>The Twittersphere is feeling</p>" +
            "<div id='content'><div class='demo-container'><div id='placeholder' style='width: 600px; height: 300px' class='demo-placeholder'></div>"+ 
            "</div></div > "+         
            "<p>Análizado <span id='numerotweet'> </span> Tweets, sobre " + monitoringPhrase + "<br>\n" +
            "</button><a href='/reset' class='btn btn-primary'>monitorear otra frase</a></div><hr>" +
            "<footer><p>&copy; 2015 - Trabajo Fin de Grado de Manuel Benítez Sánchez</p></footer>" +
            "<script src='/javascripts/bootstrap.js'></script>" +
            "<script src='/javascripts/respond.js'></script> "+
            "<script type='text/javascript'>plotear();</script> </body></html > ";
        res.send(monitoringResponse);
    }
});

app.get('/testSentiment',
    function (req, res) {
    var response = "<HEAD>" +
            "<title>Twitter Sentiment Analysis</title>\n" +
            "</HEAD>\n" +
            "<BODY>\n" +
            "<P>\n" +
            "Welcome to the Twitter Sentiment Analysis app.  What phrase would you like to analzye?\n" +
            "</P>\n" +
            "<FORM action=\"/testSentiment\" method=\"get\">\n" +
            "<P>\n" +
            "Enter a phrase to evaluate: <INPUT type=\"text\" name=\"phrase\"><BR>\n" +
            "<INPUT type=\"submit\" value=\"Send\">\n" +
            "</P>\n" +
            "</FORM>\n" +
            "</BODY>";
    var phrase = req.query.phrase;
    if (!phrase) {
        res.send(response);
    } else {
        sentiment(phrase, function (err, result) {
            response = 'sentiment(' + phrase + ') === ' + result.score;
            res.send(response);
        });
    }
});

app.get('/monitor', function (req, res) {
    beginMonitoring(req.query.phrase);
    res.redirect(302, '/');
});

app.get('/reset', function (req, res) {
    resetMonitoring();
    res.redirect(302, '/');
});

app.get('/hello', function (req, res) {
    res.send("Hello world.");
});

app.get('/watchTwitter', function (req, res) {
    var stream;
    var testTweetCount = 0;
    var phrase = 'bieber';
    // var phrase = 'ice cream';
    tweeter.verifyCredentials(function (error, data) {
        if (error) {
            res.send("Error connecting to Twitter: " + error);
        }
        stream = tweeter.stream('statuses/filter', {
            'track': phrase
        }, function (stream) {
            res.send("Monitoring Twitter for \'" + phrase + "\'...  Logging Twitter traffic.");
            stream.on('data', function (data) {
                testTweetCount++;
                // actualiza la consola al llegar a los 50 tweets
                if (testTweetCount % 50 === 0) {
                    console.log("Tweet #" + testTweetCount + ":  " + data.text);
                }
            });
        });
    });
});
