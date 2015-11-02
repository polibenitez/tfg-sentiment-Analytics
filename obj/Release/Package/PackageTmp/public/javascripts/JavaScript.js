function plotear() {
    

    // We use an inline data source in the example, usually data would
    // be fetched from a server

    var i = 4;
    // Set up the control widget

    /*var updateInterval = 30;
    $("#valormedio").val(valormedio).change(function () {
        var v = $(this).val();
        console.log(v);
    });*/
    //console.log("entra en javascript");
    //var array = [[]];
    var array1 = [[[0, 0], [2, -3], [3, 2]]];
    //console.log(array);
    console.log(array1);

    var plot = $.plot("#placeholder", array1, {
        series: {
            shadowSize: 0	// Drawing is faster without shadows
        },
        yaxis: {
            min: -6,
            max: 6
        },
        xaxis: {
            show: false
        }
    });

    function update(array) {
        //console.log(data);
       
        plot.setData(array);

        // Since the axes don't change, we don't need to call plot.setupGrid()

        plot.draw();
        setTimeout(update, 30);
    }

    
    function traerdatos() {
        $.ajax({
            //Cambiar a type: POST si necesario
            type: "GET",

            // URL a la que se enviará la solicitud Ajax
            url: "/media",
        })
   .done(function (data, textStatus, jqXHR) {
       if (console && console.log) { 
           var aux = [i, data.media];
           //var aux1 = data.media;
           array1[0].push(aux);
           console.log(aux);
           console.log(array1);
           //update(array1);
           if (i > 15) {
               array1[0].shift();
           }
           plot = $.plot("#placeholder", array1, {
               series: {
                   shadowSize: 0	// Drawing is faster without shadows
               },
               yaxis: {
                   min: -6,
                   max: 6
               },
               xaxis: {
                   show: false
               }
           });
           document.getElementById('numerotweet').innerHTML=data.ntweet;
           console.log("La solicitud se ha completado correctamente.");
           i++;
       }
       return;
   })
   .fail(function (jqXHR, textStatus, errorThrown) {
       if (console && console.log) {
           console.log("La solicitud a fallado: " + textStatus);
       }
   });
    }
    setInterval(traerdatos,1000);
    
};