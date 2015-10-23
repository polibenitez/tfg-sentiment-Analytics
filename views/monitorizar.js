var express = require('express');
var forms = require('forms');

// Declare the schema of our form:

var profileForm = forms.create({
    givenName: forms.fields.string({
        required: true
    }),
    monitoringPhrase: forms.fields.string({ required: true }),
});

// A render function that will render our form and
// provide the values of the fields, as well
// as any situation-specific locals

function renderForm(req, res, locals) {
    res.render('profile', extend({
        title: 'My Profile',
        monitoringPhrase: req.user.monitoringPhrase
    }, locals || {}));
}

// Export a function which will create the
// router and return it
console.log("estoy dentro demonitroraisdads");
module.exports = function profile() {
    
    var router = express.Router();
    
    router.use(csurf({ sessionKey: 'stormpathSession' }));
    
    // Capture all requests, the form library will negotiate
    // between GET and POST requests
    
    router.all('/', function (req, res) {
        profileForm.handle(req, {
            success: function (form) {
                // The form library calls this success method if the
                // form is being POSTED and does not have errors
                
                // The express-stormpath library will populate req.user,
                // all we have to do is set the properties that we care
                // about and then cal save() on the user object:
                req.user.monitoringPhrase = form.data.monitoringPhrase;
                req.user.customData.save();
                req.user.save(function (err) {
                    if (err) {
                        if (err.developerMessage) {
                            console.error(err);
                        }
                        renderForm(req, res, {
                            errors: [{
                                    error: err.userMessage ||
                err.message || String(err)
                                }]
                        });
                    } else {
                        renderForm(req, res, {
                            saved: true
                        });
                    }
                });
            },
            error: function (form) {
                // The form library calls this method if the form
                // has validation errors.  We will collect the errors
                // and render the form again, showing the errors
                // to the user
                renderForm(req, res, {
                    errors: collectFormErrors(form)
                });
            },
            empty: function () {
                // The form library calls this method if the
                // method is GET - thus we just need to render
                // the form
                renderForm(req, res);
            }
        });
    });
    
    // This is an error handler for this router
    
    router.use(function (err, req, res, next) {
        // This handler catches errors for this router
        if (err.code === 'EBADCSRFTOKEN') {
            // The csurf library is telling us that it can't
            // find a valid token on the form
            if (req.user) {
                // session token is invalid or expired.
                // render the form anyways, but tell them what happened
                renderForm(req, res, {
                    errors: [{ error: 'Your form has expired.  Please try again.' }]
                });
            } else {
                // the user's cookies have been deleted, we dont know
                // their intention is - send them back to the home page
                res.redirect('/');
            }
        } else {
            // Let the parent app handle the error
            return next(err);
        }
    });
    
    return router;
};
/*
var express = require("express");
var sentiment = require('sentiment');
var twitter = require('ntwitter');

var stream;

var DEFAULT_TOPIC = "UPO";

// atrapamos los errores al parsear el body
process.on('uncaughtException', function (err) {
    console.error('Caught exception: ' + err.stack);
});
process.on("exit", function (code) {
    console.log("exiting with code: " + code);
});

var app = express();
// configuramos el contenedor web
app.configure(function () {
    app.use(express.bodyParser());
    app.use(express.static(__dirname + '/public'));
});

// En esta variable sguardamos las keys de nuestra app en Twitter
// en la siguiente direcion: https://dev.twitter.com/apps
var tweeter = new twitter({
    consumer_key: 'K2oQuJ4aTPfzB29NJ0owbMwzI',
    consumer_secret: 'KiEqMp7H9yh32UYry5u2d5QJOUVriFjMCbhc6irj2lX4rIBRuK',
    access_token_key: '155300136-h84h96jh7jjQyJdImOHmjlkz7M6u5BGFBPWngfHW',
    access_token_secret: 'Gi0e7nMeoBMly3AOXUpFdnOqWlUg8yqwAKit8jaxlpISf'
});
//con esta funcion podemos comprobar que nos podemos logear bien en Twitter
app.get('/twitterCheck', function (req, res) {
    tweeter.verifyCredentials(function (error, data) {
        res.send("Hello, " + data.name + ".  I am in your twitters.");
    });
});
//variables necessarias para la medicion del sentimiento
var tweetCount = 0;
var tweetTotalSentiment = 0;
var monitoringPhrase;

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
                    console.log(data);
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
                            console.log(result.score);
                        });
                    }/*else if(data.lang === 'de'){
                        sentiment(data.text,{ lang: 'de'}, function (err, result) {
                            tweetCount++;
                            tweetTotalSentiment += result.score;
                        });
                    }*//*
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

function sentimentImage() {
    var avg = tweetTotalSentiment / tweetCount;
    if (avg > 0.5) { // positivo
        return "images/positivo.jpg";
    }
    if (avg < -0.5) { // negativo
        return "images/negativo.png";
    }
    // neutral
    return "images/content.png";
}

app.get('/',
    function (req, res) {
    var welcomeResponse = "<HEAD>" +
            "<title>Twitter Sentiment Analysis</title>\n" +
            "</HEAD>\n" +
            "<BODY>\n" +
            "<P>\n" +
            "Welcome to the Twitter Sentiment Analysis app.<br>\n" + 
            "What would you like to monitor?\n" +
            "</P>\n" +
            "<FORM action=\"/monitor\" method=\"get\">\n" +
            "<P>\n" +
            "<INPUT type=\"text\" name=\"phrase\" value=\"" + DEFAULT_TOPIC + "\"><br><br>\n" +
            "<INPUT type=\"submit\" value=\"Go\">\n" +
            "</P>\n" + "</FORM>\n" + "</BODY>";
    if (!monitoringPhrase) {
        res.send(welcomeResponse);
    } else {
        var monitoringResponse = "<HEAD>" +
                "<META http-equiv=\"refresh\" content=\"5; URL=http://" +
                req.headers.host +
                "/\">\n" +
                "<title>Twitter Sentiment Analysis</title>\n" +
                "</HEAD>\n" +
                "<BODY>\n" +
                "<P>\n" +
                "The Twittersphere is feeling<br>\n" +
                "<IMG align=\"middle\" src=\"" + sentimentImage() + "\"/><br>\n" +
                "about " + monitoringPhrase + ".<br><br>" +
                "Analyzed " + tweetCount + " tweets...<br>" +
                "</P>\n" +
                "<A href=\"/reset\">Monitor another phrase</A>\n" +
                "</BODY>";
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
});*/