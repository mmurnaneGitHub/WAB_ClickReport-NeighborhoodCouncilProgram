//NOTES:  
//QC Tests:
//MULTIPLE POLYGONS (Calico) - 8945001992
//RPZ
//Parcel 2033250060 - eligible to obtain a parking permit for a Residential Parking Zone (future test - RPZ)
//Parcel 2033250030 - Residential Parking zone is either in the process of being proposed or is already existing (future test)
//No existing RPZ found (Green) - Parcel 2033250010
//PTAG Regulated (Gray) - 7735000040
//Not Eligible (Red-brown) - 2009090013

define([
        "esri/symbols/SimpleLineSymbol",
        "esri/symbols/SimpleFillSymbol",
        "esri/tasks/BufferParameters",
        "esri/tasks/query",
        "esri/tasks/QueryTask",
        "esri/SpatialReference",
        "esri/tasks/GeometryService", 
        "dojo/_base/array", 
        "dijit/form/Button",
        "dojo/dom",
        "dojo/_base/lang",
        "dojo/promise/all",
        "dojo/_base/Color",
            'dojo/dnd/Moveable',  //start moveable info window
            'dojo/query',
            'dojo/on',
            'dojo/dom-style',
            'dojo/dom-class'

], function (
          SimpleLineSymbol,
          SimpleFillSymbol,
          BufferParameters,
          Query, QueryTask, SpatialReference,    
          GeometryService, 
          arrayUtils, 
          Button,  
          dom,
          lang,
          all,
          Color,  
            Moveable,
            dQuery,
            on,
            domStyle,
            domClass

  ) {

        //Begin Setup - put into config file eventually
        clickIdentify = true;  //Toggle to false when using other click widgets (measure) 
        var map;
        //var address = ""; //Current address
        //var r = "";   // Retrieving report...

        //Contact information
        var contactInfo = "<div style='clear:both;'><p>To learn more contact the <a href='mailto:neighborhoodcouncils@cityoftacoma.org?subject=Neighborhood%20Council%20Program'>City of Tacoma</a> <br>&nbsp;<br> </p></div>";  
        var closeButton = "";  //update depending on popup type (mobile vs desktop)
        var mobileSpacer = "<div style='width:100%; height:10px; padding-bottom:15px;'>&nbsp;</div>";   //blank space to cover up scrolled over text (doesn't cover 100%!!!)
        var candidate_location;  //current candidate location geometry  - location variable for both ESRI geocode and address match location
        //------------------------------------------------------------------------

        //Geometry Service - used to perform the buffer
        gsvc = new esri.tasks.GeometryService("https://gis.cityoftacoma.org/arcgis/rest/services/Utilities/Geometry/GeometryServer");

        //Current Parcel & Address
        currentParcel = "";
        currentSiteAddress = "";

        //Buffer parcel parameters for additional queries
        paramsBuffer = new BufferParameters();
        paramsBuffer.distances = [ -2 ];  //inside buffer   - fix for narrow parcels like 5003642450
        paramsBuffer.bufferSpatialReference = new esri.SpatialReference({wkid: 102100});
        paramsBuffer.unit = esri.tasks.GeometryService["UNIT_FOOT"];

        //Query layer - parcel (base)
        var qtparcel = new QueryTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTparcels_PUBLIC/MapServer/3");
        var qparcel = new Query();
            qparcel.returnGeometry = true;
            qparcel.outFields = ["TaxParcelNumber", "Site_Address"];
            var symbolParcel = new SimpleFillSymbol(  //Parcel symbol
              SimpleFillSymbol.STYLE_NULL,
              new SimpleLineSymbol(
                SimpleLineSymbol.STYLE_SOLID,
                new Color([255,0,0]), 
                2
              ),new Color([255,255,0,0.25])
            );

        //Query layer  
        //var qtNeighborhoodCouncils = new QueryTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTcommunity/MapServer/4");  //Neighborhood Councils
        var qtNeighborhoodCouncils = new QueryTask("https://services3.arcgis.com/SCwJH1pD8WSn5T5y/arcgis/rest/services/Tacoma_Neighborhood_Council_Districts/FeatureServer/0");  //Neighborhood Councils
        var qNeighborhoodCouncils = new Query();
            qNeighborhoodCouncils.returnGeometry = true;
            qNeighborhoodCouncils.outFields = ["NAME", "URL"];  


        //Query layer - Neighborhood Council CSV table | https://tacoma.maps.arcgis.com/home/item.html?id=c0f88add856c4ccaa814aa3cc4098827
        var qtNC = new QueryTask("https://services3.arcgis.com/SCwJH1pD8WSn5T5y/arcgis/rest/services/Neighborhood_Council_Assignments_(csv)_ReadOnly/FeatureServer/0");
        var qNC = new Query();
            qNC.outFields = ["*"];

        //Query for Councilmanic
        var qtCouncilManic = new QueryTask("https://services3.arcgis.com/SCwJH1pD8WSn5T5y/arcgis/rest/services/Tacoma_Councilmanic_District_Query_Layer/FeatureServer/0");
        var qCouncilManic = new Query();
            qCouncilManic.outFields = ["District", "WebPage"];
            qCouncilManic.returnGeometry = false;
        //END Setup------------------------------------------------------------------------------------------------------------------

      var mjm_ClickReportFunctions = {

      newReport: function(currentMap, mapClick, SR) {
        map = currentMap;  //update map & close button
        candidate_location = mapClick; //reset for popup window 
        paramsBuffer.outSpatialReference = SR; //Update SR 

        //Make map's infoWindow draggable/moveable if not a mobile popup -----------------------------------------
        //(https://jsfiddle.net/gavinr/cu8wL3b0/light/)

          //Determine if desktop or mobile popup being used
          if (map.infoWindow.domNode.className != "esriPopupMobile") {
            closeButton = "<div style='float:right;'><button dojoType='dijit/form/Button' type='button' onClick=\"document.getElementsByClassName('titleButton close')[0].click();\"><b>Close</b></button><br>&nbsp;</div>";
            var handle = dQuery(".title", map.infoWindow.domNode)[0];
            var dnd = new Moveable(map.infoWindow.domNode, {
                handle: handle
            });

              //When infoWindow moved, hide pointer arrow:
              on(dnd, 'FirstMove', function() {
                  // hide pointer and outerpointer (used depending on where the pointer is shown)
                  theNodes = [".outerPointer", ".pointer"];
                  arrayUtils.forEach(theNodes, function(theNode) {
                    var arrowNode =  dQuery(theNode, map.infoWindow.domNode)[0];
                       if (domStyle.get(arrowNode, "display") === "block") {
                        domStyle.set(arrowNode, "display", "none");  
                           //Reset infoWindow (put back pointer) when closed
                          var closeReset = dQuery(".titleButton.close", map.infoWindow.domNode)[0];
                            on(closeReset, 'click', function() {
                                     domStyle.set(arrowNode, "display", "");  //reset - blank will let it rebuild correctly on next open
                             }.bind(this));
                       };
                 });

              }.bind(this));
            } else {
              //Mobile popup
              closeButton = ""; //Don't use close button
              if (dQuery(".titleButton.arrow.hidden", map.infoWindow.domNode)[0] !== undefined) {
                //https://dojotoolkit.org/reference-guide/1.7/dojo/replaceClass.html
                domClass.replace(dQuery(".titleButton.arrow.hidden", map.infoWindow.domNode)[0], "", "hidden");  //Update mobile popup node class removing 'hidden'
              }
           } //end mobile popup check
       //---------------------------------------------------------------------------------------------------
        
	        if (clickIdentify){
	          //Only do if other click widgets (measure) are not being used
	          this.executeQueries(mapClick);  //need to be consistent with geocoders (sends map point)  
	        }
      },

      executeQueries: function(e) {
        this.cleanUp();
        qparcel.geometry = e;  // use the map click, geocode, or device location for the query geometry
        qtparcel.execute(qparcel, lang.hitch(this, this.handleQueryParcel));  //query for a parcel at location - need to use lang.hitch to keep this in scope
      },

      cleanUp: function() {
        map.graphics.clear(); //remove all graphics - buffer and points
        if (map.infoWindow.isShowing) {
         map.infoWindow.hide(); //Close existing popups
        }
      },

        handleQueryResults: function (results) {
          var COT_Message = ""; //Neighborhood Council & Councilmanic details
          var r = ""; //complete popup message
          var item1, item2; // results from deferred lists are returned in the order they were created        
          if (!results[0].hasOwnProperty("features")) { // make sure both queries finished successfully
            console.error("Query 1 failed.");
          }
          if (!results[1].hasOwnProperty("features")) {
            console.error("Query 2 failed.");
          }

          item1 = results[0].features; //Neighborhood Council
          item2 = results[1].features; //CouncilManic

          if (item1.length > 0 && item2.length > 0) { //Both layers exist on the parcel - inside Tacoma
            var urlNCP = "<a href='" + item1[0].attributes.URL + "' target='_blank' title='Neighborhood Council Program Website'>Website</a>";  //Link to individual NCP page
            var CC_Message = "<div style='clear:both;'></div><div><a href='" + item2[0].attributes.WebPage + "' target='_blank'>City Council District " + item2[0].attributes.District + "</a><br>&nbsp;</div>"

            //AGO CSV NCS Sharepoint table query
            qNC.where = "GIS = '" + item1[0].attributes.NAME + "'"; //Update query - just use first polygon NC
            qtNC.execute(qNC, function (results) { //Just use first value (assume no multiple polygons)
              COT_Message += "<div style='clear:both;'></div><div><b>" + results.features[0].attributes.Neighborhood_Council + " Neighborhood Council</b></div>";
              COT_Message += "<div style='clear:both;'></div><div><b>&nbsp;Meeting Location: </b>" + results.features[0].attributes.Location + "</div>";
              COT_Message += "<div style='clear:both;'></div><div><b>&nbsp;Meeting Address: </b>" + results.features[0].attributes.Meeting_Location_Address + "</div>";
              COT_Message += "<div style='clear:both;'></div><div><b>&nbsp;Meeting Day: </b>" + results.features[0].attributes.Meeting_Day + "</div>";
              COT_Message += "<div style='clear:both;'></div><div><b>&nbsp;Meeting Time: </b>" + results.features[0].attributes.Time + "</div>";
              COT_Message += "<div style='clear:both;'></div><div><b>&nbsp;Board Chair: </b>" + results.features[0].attributes.Board_Chair + "</div>";
              COT_Message += "<div style='clear:both;'></div><div>&nbsp;<a href='mailto:" + results.features[0].attributes.NC_Email + "'>Email</a> | ";
              COT_Message += urlNCP;
              COT_Message += "&nbsp;| <a title='Driving Directions' href=\"https://www.google.com/maps/dir/?api=1&origin=" + currentSiteAddress  + ",Tacoma,WA&destination=" +  results.features[0].attributes.Meeting_Location_Address + ",Tacoma,WA&travelmode=driving" + "\" target=\"_blank\">Driving Directions</a><br>&nbsp;</div>";

              r = COT_Message + CC_Message + contactInfo + closeButton + mobileSpacer;
              dom.byId('messages').innerHTML = r; //update report message
            }, function (err) {
              //Third Deferred Error
              alert("Error in NC identify: " + err.message);
              console.error("Identify NC Error: " + err.message);
            });
          } else { //outside Tacoma
            COT_Message += "<div style='clear:both;'></div><div><b>No Neighborhood Council Program. <br>Address is outside the City Limits of Tacoma.</b><br>&nbsp;</div>";
            r = COT_Message + contactInfo + closeButton + mobileSpacer;
            dom.byId('messages').innerHTML = r; //update report message
          }
        },
        
      handleQueryParcel: function(results) {
        currentParcel = ""; //clear out previous results
        currentSiteAddress = ""; //clear out previous results
        parcel = results.features;
        //Parcel info 
        if (parcel.length > 0) {
          //Parcel found - update address/parcel info
          var title = "Neighborhood Council Program";
          currentParcel = parcel[0].attributes["TaxParcelNumber"];
          currentSiteAddress = parcel[0].attributes["Site_Address"];
          var address = "<div><b>Address:</b> " + currentSiteAddress + "<br>&nbsp;</div>";
          address += "<div style='clear:both;' id='messages'></div>"; //place holder id='messages'for the rest of the query info - filled in by deferred functions

          //Use parcel geometry for RPP query - put results into 'messages' div
          paramsBuffer.geometries = [parcel[0].geometry];
          var bufferedGeometries = gsvc.buffer(paramsBuffer); //BUFFER the parcel

          bufferedGeometries.then(lang.hitch(this, function(bufferedGeometries) { //Using dojo deferred 'then' function to set callback and errback functions
            qCouncilManic.geometry = qNeighborhoodCouncils.geometry = bufferedGeometries[0]; //Query with buffer polygon - use parcel inside buffer, not map click point

            item1 = qtNeighborhoodCouncils.execute(qNeighborhoodCouncils); //Neighborhood Council query
            item2 = qtCouncilManic.execute(qCouncilManic); //Councilmanic query
            promises = new all([item1, item2]);
            promises.then(this.handleQueryResults); //Wait for all defers (2) before processing
          }), function(err) { // Process errors
            alert(err);
          });
        } else {
          //Not a parcel - REMOVE PARCEL INFO
          var title = "Non-parcel"
          address = "<div><i>This location is not a parcel.</i> </div><div id='messages'></div>";
          address += "<div><i>Try clicking a nearby parcel.</i></div>" + closeButton;
          map.setLevel(18); //zoom to level 18 since there isn't a parcel to zoom to
        }

        //Open info window and update content - Councilmanic & NCP text will be updated by handleQueryResults when ready
        map.infoWindow.setTitle(title);
        var infoDiv = document.createElement("div");
        infoDiv.innerHTML = address;
        map.infoWindow.setContent(infoDiv); //add content details          

        //display the info window with the address information
        var screenPnt = map.toScreen(candidate_location); //from map click or geocode

        map.infoWindow.show(screenPnt); //open popup

        arrayUtils.forEach(parcel, function(feat) {
          feat.setSymbol(symbolParcel);
          map.graphics.add(feat); // Add the parcel boundary to the map
          map.setExtent(feat._extent.expand(3.0)); //Zoom map to a multiple of parcel extent
        });

        map.centerAt(candidate_location); //no offset
      } //last function
         
  }; //end mjm_ClickReportFunctions

  return mjm_ClickReportFunctions;  //Return an object that exposes new functions

});

