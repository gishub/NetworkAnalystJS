var map;
var routeTasks = [];
var impedance = null;

var stopSymbol = null;
var routeSymbol = null;
var highlightRouteSymbol = null;
var routes = [];
var responsesTime = [];
var segClckIdx = null;
var grid = null;
var data = [];

var segmentGraphic = null;

define(["dojo/parser",
    "app/config",
    "esri/map",
    "esri/tasks/RouteParameters",
    "esri/tasks/RouteResult",
    "esri/tasks/RouteTask",
    "esri/tasks/FeatureSet",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/symbols/SimpleLineSymbol",
    "esri/graphic",
    "esri/geometry/Point",
    "esri/lang",
    "dojo/_base/array",
    "dojo/_base/Color",
    "dojo/on",
    "dojo/dom",
    "dojo/dom-construct",
    "dojo/number",
    "dgrid/Grid",
    "dojo/domReady!"
], function(parser,
    config,
    Map,
    RouteParameters,
    RouteResult,
    RouteTask,
    FeatureSet,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    Graphic,
    Point,
    esriLang,
    arr,
    Color,
    on,
    dom,
    domConstruct,
    number,
    Grid) {

    return {
        config: config,

        /**
         * startup function : entry point !
         * @return {[type]} [description]
         */
        startup: function() {
            // call the parser to create the dijit layout dijits
            parser.parse();
            // init map
            this.initMap();
            // init RouteTasks
            this.initTasks();
            // connect button handler
            this.initUX();
        },

        /**
         * [initMap description]
         * @return {[type]} [description]
         */
        initMap: function() {

            // new Map centered on Lugdunum
            map = new Map("mapDiv", {
                center: [4.842223, 45.759723],
                zoom: 13,
                basemap: "streets"
            });
        },

        /**
         * [initTasks description]
         * @return {[type]} [description]
         */
        initTasks: function() {
            // is config file exists ?
            if (config) {
                // solveRoute URLs
                if (config.routeTasks) {
                    console.log("Creating RouteTask with " + config.routeTasks);
                    arr.forEach(config.routeTasks, function(routeTaskURL) {
                        console.log("Creating RouteTask with URL " + routeTaskURL);
                        var routeTask = new RouteTask(routeTaskURL);
                        dojo.connect(routeTask, "onSolveComplete", showRouteWithDirections);
                        //dojo.connect(routeTask, "onSolveComplete", showRouteWithRoutes);
                        dojo.connect(routeTask, "onError", solveErrorHandler);
                        routeTasks.push(routeTask);
                    });
                } else {
                    console.log("Unbale to create routeTasks");
                }
                // Impedance
                if (config.impedance) {
                    impedance = config.impedance;
                    console.log("Creating solveParameter with impedance " + impedance);
                } else {
                    console.log("Unable to read impedance parameter");
                }

            } else {
                console.log("Unbale to read configuration");
            }

            /**
             * ----------------------------------------------------------------------
             * Inner functions
             */

            /**
             * Draws the resulting routes on the map with the directions info
             * @param  {[type]} evt [description]
             * @return {[type]}     [description]
             */

            function showRouteWithDirections(evt) {
                var end = new Date();
                arr.forEach(evt.routeResults, function(routeResult) {
                    // 
                    var directions = routeResult.directions;
                    console.log(directions.routeName + ", " + directions.summary.totalLength + " km, " + directions.summary.totalTime + " min");
                    // Zoom to results.
                    map.setExtent(directions.mergedGeometry.getExtent(), true);
                    // Add route to the map.
                    var routeGraphic = new Graphic(directions.mergedGeometry, routeSymbol);
                    map.graphics.add(routeGraphic);
                    // store the route for the grid
                    routes.push(routeGraphic);
                    // ?
                    //routeGraphic.getShape().moveToBack();
                    // ?
                    //map.setExtent(directions.extent, true);

                    //Display the route infos.
                    var totalDistance = number.format(directions.totalLength);
                    var totalTime = number.format(directions.totalTime);
                    console.log(directions.routeName + "(2), " + totalDistance + " km, " + totalTime + " min");
                    var responseTime;
                    arr.forEach(responsesTime, function(elem) {
                        console.log(elem);
                        if (elem.routeName == directions.routeName) {
                            responseTime = getDiffDate(end - elem.start);

                        }
                    });
                    data.push({
                        "detail": directions.routeName,
                        "distance": totalDistance,
                        "time": getHM(totalTime),
                        "response": responseTime
                    });
                });

                if (grid) {
                    grid.refresh();
                }
                grid = new Grid({
                    renderRow: renderList,
                    showHeader: false
                }, "grid");
                grid.renderArray(data);
                grid.on(".dgrid-row:click", highlightRoute);

                // show messages
                var msgs = ["Server messages:"];
                arr.forEach(evt.messages, function(message) {
                    msgs.push(message.type + " : " + message.description);
                });
                if (msgs.length > 1) {
                    var log = msgs.join("\n - ");
                    console.log(logMessage);
                    alert(logMessage);
                }
            };

            function getHM(minutes) {
                var t = number.parse(minutes);
                var hr = Math.floor(t / 60);
                var min = Math.floor(t % 60);
                var sec = Math.floor((t - (hr * 60) - min) * 60);
                if (min < 10) {
                    min = "0" + min
                }
                if (sec < 10) {
                    sec = "0" + sec
                }
                return hr + ":" + min + ":" + sec;
            };

            function getDiffDate(difference) {
                var diff = new Date(difference);
                var msec = diff.getMilliseconds()
                var sec = diff.getSeconds()
                var min = diff.getMinutes()
                var hr = diff.getHours() - 1
                if (min < 10) {
                    min = "0" + min
                }
                if (sec < 10) {
                    sec = "0" + sec
                }
                if (msec < 10) {
                    msec = "00" + msec
                } else if (msec < 100) {
                    msec = "0" + msec
                }
                var retour;
                if (hr == 0) {
                    retour = min + ":" + sec + ":" + msec;
                } else {
                    retour = hr + ":" + min + ":" + sec + ":" + msec;
                }
                return retour;
            };

            /**
             * Draws the resulting routes on the map
             * @param  {[type]} evt [description]
             * @return {[type]}     [description]
             */

            function showRouteWithRoutes(evt) {
                arr.forEach(evt.routeResults, function(routeResult) {
                    var routeGraphics = routeResult.route;
                    console.log(routeGraphics.attributes.Name + " " + routeGraphics.attributes.Total_Length);
                    var sls = new SimpleLineSymbol().setColor(getRandomColor()).setWidth(4);
                    routeGraphics.setSymbol(sls);
                    map.graphics.add(routeGraphics);
                    routes.push(routeGraphics);
                });

                var msgs = ["Server messages:"];
                arr.forEach(evt.messages, function(message) {
                    msgs.push(message.type + " : " + message.description);
                });
                if (msgs.length > 1) {
                    var log = msgs.join("\n - ");
                    console.log(logMessage);
                    alert(logMessage);

                }
            };

            /**
             * [getRandomInt description]
             * @param  {[type]} min [description]
             * @param  {[type]} max [description]
             * @return {[type]}     [description]
             */

            function getRandomInt(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };

            /**
             * [getRandomColor description]
             * @return {[Color]} [description]
             */

            function getRandomColor() {
                var r = getRandomInt(0, 255);
                var g = getRandomInt(0, 255);
                var b = getRandomInt(0, 255);
                return new Color([r, g, b, .6]);
            };


            function renderList(obj, options) {
                var template = "<div class='detail'><div style='max-width:70%;float:left;'>${detail}<br />client processing in ${response} ms</div><span style='float:right;' class='distance'>${distance} km<br/>in ${time}</span></div>";
                return domConstruct.create("div", {
                    innerHTML: esriLang.substitute(obj, template)
                });
            };

            function highlightRoute(e) {
                //Grid row id corresponds to the route to highlight
                var index = grid.row(e).id;
                if (segClckIdx != index) {
                    var segment = routes[index];
                    map.setExtent(segment.geometry.getExtent(), true);

                    if (!segmentGraphic) {
                        segmentGraphic = map.graphics.add(new Graphic(segment.geometry, highlightRouteSymbol));
                    } else {
                        segmentGraphic.setGeometry(segment.geometry);
                    }
                }
            };

            /**
             * Reports any errors that occurred during the solve
             */

            function solveErrorHandler(err) {
                var msg = "An error occured\n" + err.message + "\n" + err.details.join("\n")
                console.log(msg);
                alert(msg);
            };
            /**
             * ----------------------------------------------------------------------
             */
        },

        initUX: function() {
            // stops Symbol
            stopSymbol = new SimpleMarkerSymbol({
                "color": [255, 128, 128, 255],
                "size": 12,
                "angle": -30,
                "xoffset": 0,
                "yoffset": 0,
                "type": "esriSMS",
                "style": "esriSMSCircle",
                "outline": {
                    "color": [255, 0, 0, 255],
                    "width": 1,
                    "type": "esriSLS",
                    "style": "esriSLSSolid"
                }
            });

            on(dom.byId("solveRoutesBtn"), "click", solveRoute);

            routeSymbol = new SimpleLineSymbol().setColor(new Color([0, 128, 255, 0.7])).setWidth(4);
            highlightRouteSymbol = new SimpleLineSymbol().setColor(new Color([255, 0, 0, 0.5])).setWidth(8);
            /**
             * ----------------------------------------------------------------------
             * Inner functions
             */

            /**
             * [solveRoute description]
             * @param  {[type]} evt [description]
             * @return {[type]}     [description]
             */

            function solveRoute(evt) {
                // clear grphics
                map.graphics.clear();
                //
                routes = [];
                //
                responsesTime = [];
                // refresh grid content
                data = [];
                if (grid) {
                    grid.refresh();
                }
                segmentGraphic = null;

                // getStops from input
                var stopsValues = dom.byId("stopsTxf").value;
                console.log("solve route for stops : " + stopsValues);
                var stops = [];
                var stopsOnMap = false;
                // valid stops and routeTasks ok ?
                if (stopsValues && routeTasks.length != 0) {
                    stops = stopsValues.split(";");
                    // iterate over all routeTasks
                    arr.forEach(routeTasks, function(routeTask, a) {
                        // 2 call for solveRoute
                        //    first : is using hierarchy
                        //    second : is not using hierarchy
                        for (var i = 0; i < 2; i++) {
                            var routeName = "Route " + a;
                            var routeParams = new RouteParameters();
                            routeParams.stops = new FeatureSet();
                            // first or second ?
                            if (i == 0) {
                                routeParams.useHierarchy = true;
                                routeName = routeName + " useHierarchy";
                            } else {
                                routeParams.useHierarchy = false;
                                routeName = routeName + " no hierarchy";
                            }
                            // set impedance
                            routeParams.impedanceAttribute = impedance;
                            routeParams.returnDirections = true;
                            routeParams.returnRoutes = false;
                            // log route name
                            console.log(routeName);
                            // assign stops with routeName using routeName
                            arr.forEach(stops, function(stop) {
                                var stopGraphic = new Graphic(getPoint(stop), stopSymbol, {
                                    RouteName: routeName
                                });
                                // push stopGraphic to the featureSet
                                routeParams.stops.features.push(stopGraphic);
                                if (!stopsOnMap) {
                                    map.graphics.add(stopGraphic);
                                }

                            });
                            stopsOnMap = true;
                            var start = new Date();
                            var response = {
                                "routeName": routeName,
                                "start": start,
                                "end:": null
                            }
                            responsesTime.push(response)
                            // go and solve Route !
                            routeTask.solve(routeParams);
                        };
                    });
                } else {
                    console.log("Unbale to parse stops coordinates");
                }
            };

            /**
             * [getPoint description]
             * @param  {[type]} stopValue [description]
             * @return {[type]}           [description]
             */

            function getPoint(stopValue) {
                var coord = stopValue.split(",");
                return new Point(coord);
            };
            /**
             * ----------------------------------------------------------------------
             */
        }

    }
});
