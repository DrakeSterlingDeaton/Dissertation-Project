// background.js runs on the browser level, rather than the webpage level, running consistently in the background of the browser.

//////////////////////////////////  Functions //////////////////////////////////

/////////////////// Initilizing Functions /////////////////

function initPort() {           // uses chrome's native messaging protocol to establish connection with python script
    port = chrome.runtime.connectNative('com.langpro');         
};

function browStartProtocol() {          // initiates native messaging and context menu functionality
    initPort();  
    /////////// Context Menu ////////////////          Adding actions to context menu
    var contextMenuItem = {"id": "WF", "title": "WhereFinder", "contexts": ["selection"] };   // "WhereFinder" context menu details
    var contextSubMenuItem = {"id": "WFLoading", parentId: "WF", "title": "WhereFinder is loading...", "contexts": ["selection"] }      // "WhereFinder" context submenu details
    chrome.contextMenus.create(contextMenuItem);                    // creating context menu 
    chrome.contextMenus.create(contextSubMenuItem);                 // Creating context submenu
    setTimeout(function(){chrome.contextMenus.remove("WFLoading"); }, 10000);       // Removing submenu item after 10 seconds (long enough for background host to load)
};

function pageCheck(clickData) {     // checks if the current page is accessible for 'content injection' which is a requirement for using this extension
    return new Promise( (resolve, reject) => {
        chrome.tabs.query( {active: true, currentWindow: true}, (tab) => {      // fetches current tab url
            console.log('checking page...');
            if (typeof tab !== "undefined") {           // if fetching the tab url fails...
                console.log('tab has a value... page check passed.')
                resolve(clickData);
            } else {              // exit the script
                reject('Sorry! Unable to run extension on this page.');     // alert the user
            };
        });
    }, clickData);                  // passing through clickData into promise for resolve return
};

/////////////////// Port Handling /////////////////

function portListener(msg) {                // Listens to port and handles incomming messages
    messageProcessor(msg, msg.textObj.msgTypeIn);
};

function messageProcessor(msg, type) {         // processes msg's to and from python 'langpro.py' script
    if (type === 'out_req') {           // First msg to pipe. adding info to object. (obj will will contain: mousePos, text, & request type)
        msg.type = "out_req";           // Sets msg type to the langpro.py script can initiate the correct processing
        return msg;
    }; if (type === 'in_query') {       // Optional msg from host clarifying ambiguity of original input text.
        queryOptions = prepUsrQry(msg);         // preping DB search results from the user's input text.
        WFContextMenu(queryOptions, msg.textObj.tabId, msg.textObj.mouseX, msg.textObj.mouseY);     // initiating WFContextMenu script to display potential matches to user input data
        waitForMenuSelection(msg.textObj)                                   // promise that waits for the user to select an contextmenu option, and then either:
            .then( textObj => messageProcessor(textObj, 'out_query') )      // - sends the user's choice
            .catch( (err) => {errorAlert(err)} )                            // - or raises an error
    }; if (type === 'out_query') {         // Optional msg responding to host query. 
        msg.type = 'out_query';                 // Sets msg type to the langpro.py script can initiate the correct processing
        WFDisplayMainDisplay(msg.tabId, msg.textObj)        // Initiates WF Main Display scripts
        port.postMessage(msg);
    }; if (type === 'in_ans') {            // Response ans to initial text request.
        WFDisplayMainDisplay(msg.tabId, msg.textObj.processedText)          // initiates WF Main Display scripts, and then displays the content...
            .then( (textObj) => {                                           // ... if the promise fails, then the script has already been initialized previously
                WFDisplayContent(msg.textObj.tabId, textObj);               // so in either case the content script can be run
                initPort()                                                  // re-initializing native messaging port, ready for the next query.
            })
            .catch( (textObj) => {WFDisplayContent(msg.textObj.tabId, textObj)} )
    };
};

function onDisconnection(err) {                // Listens to port and handles disconnection issues
    errorAlert(err);
};

function errorAlert(err) {                      // alerts the user of any errors
    alert('Error:' + err);
}

/////////////////// WF HTML /////////////////

function WFContextMenu(queryOptions, tabId, mouseX, mouseY) {               // Generates WF content menu
    for (var obj of queryOptions.value) {                       // iterating over query options
        obj['title'] = obj['title'].replace('\n','');           // removing any newlines
    }
    var WFContextMenu       =       [];
    var parentDiv           =       "var div = document.createElement( 'div' );" +              // creating parent div (context menu box)
                                    "document.body.appendChild( div );" +
                                    "div.id = 'WFContextMenu';" +
                                    "div.style.width = 'fit-content';" +   
                                    "div.style.height = 'fit-content';" + 
                                    "div.style.position = 'fixed';" + 
                                    "div.style.top = '" + mouseY + "px' ;" +
                                    "div.style.left = '" + mouseX + "px' ;" + 
                                    "div.style.paddingTop = '4px' ;" + 
                                    "div.style.paddingBottom = '4px' ;" +
                                    "div.style.zIndex = '10000';" +
                                    "div.style.display = 'flex'; " +
                                    "div.style.flexDirection = 'column'; " +
                                    "div.style.backgroundColor = 'rgb(127, 126, 129)'; " +
                                    "div.style.borderRadius = '4%'; "
    WFContextMenu.push(parentDiv);     
    for (var obj of queryOptions.value) {                                                   // creating children divs (context menu option boxes)
        var num             =       obj.id;
        var title           =       obj.title;                                              // each child div title is the query option
        var queryButton     =       "var input" + num + " = " +
                                    " document.createElement( 'input' );" +        
                                    " document.getElementById('WFContextMenu').appendChild( input" + num + " );" +
                                    " input" + num + ".id = 'WFContextMenuButton" + num + "'; " +
                                    " input" + num + ".className = 'WFContextMenuButtons'; " +
                                    " input" + num + ".type = 'button'; " +
                                    " input" + num + ".value = '" + title + "'; " +
                                    " input" + num + ".style.width = '100%'; " +
                                    " input" + num + ".style.height = 'fit-content'; " +
                                    " input" + num + ".style.paddingTop = '3px'; " +
                                    " input" + num + ".style.paddingBottom = '3px'; " +
                                    " input" + num + ".style.paddingLeft = '10px'; " +
                                    " input" + num + ".style.paddingRight = '10px'; " +
                                    " input" + num + ".style.marginTop = '0.5px'; " +
                                    " input" + num + ".style.marginBottom = '0.5px'; " +
                                    " input" + num + ".style.backgroundColor = 'transparent'; " +
                                    " input" + num + ".style.fontSize = '13px'; " +
                                    " input" + num + ".style.fontFamily = 'Helvetica'; " +
                                    " input" + num + ".style.textAlign = 'left'; " +
                                    " input" + num + ".style.color = 'rgb(255, 255, 255)'; "  +
                                    " input" + num + ".style.border = '0'; "             
        WFContextMenu.push(queryButton);
    };                                                                                                  // creating JS functions to:
    var listenerScript      =       " document.addEventListener('click', function(click) { " +           // 1 - listen for a click
                                    " var contextMenu = document.getElementById('WFContextMenu'); " +       //  - and removing the WFContextMenu box
                                    " contextMenu.parentNode.removeChild(contextMenu); " + 
                                    " });"
    var listenerScript2     =       " var menuButtons = document.getElementsByClassName('WFContextMenuButtons'); " +    // 2 - listen for clicks on each specific button
                                    " for (var button = 0; button < menuButtons.length; button ++) { " +                //      - and WF's background script information on which
                                    "    menuButtons[button].onclick =  function(click) { " +                           //      button was clicked
                                    "       chrome.runtime.sendMessage('inpfiiifhajlhicplcogoacfnmkmgpen', " +          
                                    "       {'action':'buttonPress', 'id':this.id, 'value':this.value }); " +
                                    "       var contextMenu = document.getElementById('WFContextMenu'); " +
                                    "       contextMenu.parentNode.removeChild(contextMenu); " +                        // and then remove WFContextMenu
                                    "    };" +
                                    " }; "
    for (script of WFContextMenu) {
        chrome.tabs.executeScript( tabId, { code: script }, function(){ });                     // executing HTML generating scripts
    };
    chrome.tabs.executeScript( tabId, { code: listenerScript }, function(){ console.log('added: ' + listenerScript); });    // executing JS functions
    chrome.tabs.executeScript( tabId, { code: listenerScript2 }, function(){ console.log('added: ' + listenerScript2); });  // executing JS functions
};

function waitForMenuSelection(textObj) {                                    // waits for WF context menu button to be clicked
    return new Promise( (resolve, reject) => {
        chrome.runtime.onMessage.addListener( function(msg) {
            if (msg.action == 'buttonPress') {                              
                textObj.queryAns = [msg.id, msg.value]                      // adds context menu select data is textObj
                resolve(textObj);
            } else {
                reject()
            }
        });
    }, textObj);
};

/////////////////// WF Data 1: Packaging for port ///////////////// Used to gather/package data to send to backend (mousePos & input text)

function fetchMousePos(text) {                   // returns a promise that fetches the position of the last mouse click, and returns a WhereFinder data object
    return new Promise( (resolve, reject) => {
        try {
            chrome.tabs.query({active: true, currentWindow: true}, (tab) => {
                tabId = tab[0].id;
                chrome.tabs.sendMessage(tabId, {"tabId": tabId, "action": "WFClicked"}, function responseCallBack(response) {  // sends msg to active tab page who will reply with where the mouse was last clicked
                WFData = {'tabId': response.tabId, 'text': text, 'mouseX': response.x, 'mouseY': response.y}         // packages up mouse click data with selection text
                resolve(WFData)                 // resolves promise & returns the WFData object
                });
            }); 
        } catch { reject(err) };
    }, text);       // original input text variable is passed into the promise
};

function sendWFData (WFData) {          // establishes a connection, and sends data too, the language process host
    port.onMessage.addListener(portListener);                       // adding port listeners
    port.onDisconnect.addListener(onDisconnection);                    // adding port listeners
    messageOut = messageProcessor(WFData, 'out_req');          // capturing message to be sent 
    port.postMessage(messageOut);                              // sending JSON object containing click data to the host app
};

/////////////////// WF Data 2: Handling response queries  /////////////////  Functions are only used if text disambiguation requires user confirmation

function prepUsrQry(msg) {          // creates an array of search results & formats their text
    resGen = prepSrcRes(msg.textObj.processedText.DBSearchResults);    // generates prepped search results
    numOfResults = resGen.next();           // first gives the total number of search results
    results = resGen.next();                // second gives an array of the formatted text for each search result
    for (var obj of results.value) {console.log(obj)};      // deletable
    return results
};

function* prepSrcRes(searchResults, resArray=[]) {     // generator function that generates prepped search results
    numOfResults = Object.keys(searchResults).length                    
    for (var i of Array(numOfResults).keys()) {                             // iterates over the the range of the number of search results
        obj = {"id": ""+i, "title": searchResults[i].localName + ", " + searchResults[i].iso}        // formats an object for each search result
        resArray.push(obj)                              // adds each search result object to an array
    };
    yield numOfResults
    yield resArray
};

/////////////////// WF Main Display Functions  /////////////////

async function WFDisplayMainDisplay(tabId, textObj) {
    try {                                       // runs all WF Display scripts using promises
        var response1 = await initWFHTML(tabId)
        var response2 = await initJQuery1(tabId)
        var response3 = await initJQuery2(tabId)
        var response4 = await initWFJS(tabId)
    } catch {
        return textObj                      // if the scripts fail, the textObj is returned (an assumption is made 
    };                                      // here that the scripts will only fail if they've already been executed)
}

function initWFHTML(tabId) {                        // initializing WF HTML box on webpage
    return new Promise( function(resolve, reject) {
        try {
            chrome.tabs.sendMessage(tabId, {"action": "WFDisplay"}, function responseCallBack(response) {
                resolve(response);
            });
        } catch (err) {reject(err)};
    }, tabId);
};

function initJQuery1(tabId) {                       // initializing jquery on the webpage
    return new Promise( function(resolve, reject) {
        try {
            chrome.tabs.executeScript( tabId, {file: "js/jquery-1.12.4.js"}, function responseCallBack(response) {
                resolve(response);
            });
        } catch (err) {reject(err)};
    }, tabId);
};

function initJQuery2(tabId) {                       // initializing jqueryUI on the webpage
    return new Promise( function(resolve, reject) {
        try {
            chrome.tabs.executeScript( tabId, {file: "js/jquery-ui.js"}, function responseCallBack(response) {
                resolve(response);
            });
        } catch (err) {reject(err)};
    }, tabId);
};

function initWFJS(tabId) {                          // initializing js functions for the WF box on the webpage
    return new Promise( function(resolve, reject) {
        try {
            chrome.tabs.executeScript( tabId, {file: "js/WFMainDisplay.js"}, function responseCallBack(response) {
                resolve(response);
            });
        } catch (err) {reject(err)};
    }, tabId);
};

async function WFDisplayContent(tabId, textInfo) {          // runs all WF Content scripts using promises
    var response5 = await initWFMap(tabId, textInfo.placeID, textInfo.ownLoc)  
    var response6 = await initWFWiki(tabId, textInfo.wiki)
    var response7 = await initWFImages(tabId, textInfo.images)
    var response8 = await initWFNews(tabId, textInfo.news)
    var response9 = await removeLoading(tabId);
}

function initWFMap(tabId, placeId, ownLoc) {                // adds iframe for the google maps display
    return new Promise( function(resolve, reject) {
        try {
            script = "mapiframe = document.createElement('iframe');" +              // creates iframe element withing WF Map element
            "mapiframe.id = 'iframeWF';" +
            "mapiframe.src = '" + chrome.extension.getURL('html/WFMapIframe.html') + "?" + "placeId=" + placeId + "&ownLoc=" + ownLoc +  "';" +     // adds Google Maps query...
            "mapiframe.frameborder = '0';" +                                                                                        // data for google maps to the iframe HTML's src 
            "mapiframe.width = '100%';" +
            "mapiframe.height = '100%';" +
            "mapiframe.zIndex = '999999999999';" +
            "document.getElementById('WFDisplayBox_MapInnerBox').appendChild(mapiframe)"
            chrome.tabs.executeScript( tabId, { code: script }, function(){
                resolve();
            });
        } catch (err) {
            alert(err);
            reject(err);
        };
    }, tabId, placeId, ownLoc);
};

function initWFWiki(tabId, wiki) {                          // add wiki data to WF display
    return new Promise( function(resolve, reject) {
        try {
        var script = "document.getElementById('WFDisplayBox_InfoTitleBoxP').innerHTML = `"  +   wiki["wikiPage-title"]     + "`;" +
                     "document.getElementById('WFDisplayBox_InfoTitleBoxP_Link').href = `"  +   wiki["wikiPage-url"]       + "`;" +
                     "document.getElementById('WFDisplayBox_InfoBoxPhotoIMG').src     = `"  +   wiki["wikiPage-img"]       + "`;" +
                     "document.getElementById('WFDisplayBox_InfoBoxP').innerHTML      = `"  +   wiki["wikiPage-sum"]       + "`;"
            chrome.tabs.executeScript(tabId, {code: script}, function responseCallBack(response) {
                resolve(response);
            });
        } catch (err) {
            reject(err);
        };
    }, tabId, wiki);
};

function timeDif(datetimeNow, datetimeArticle) {        // determines how old an article is from now
    var MS_PER_DAY = 1000 * 60 * 60 * 24;           // code adapted from: https://stackoverflow.com/questions/3224834/get-difference-between-2-dates-in-javascript. taken on July 20th 2019.
    var diffInDays = (datetimeNow - datetimeArticle) / MS_PER_DAY;      // dividing difference between the two dates by the total number of MS in a day
    var fullDays = Math.floor(diffInDays);                              // extracting the number of full days
    var diffInHrs = (diffInDays - fullDays) * 24;                       // multiplying the remainder by the number of hours in a day
    var fullHours = Math.floor(diffInHrs);                              // extracting the number of full hours
    var diffInMins = (diffInHrs - fullHours) * 60;                      // multiply the remainder by the number of minutes in an hour
    var fullMins = Math.floor(diffInMins);                              // extracting the number of full minutes
    if (fullDays > 1) {return fullDays + " days ago"}                   // returning 'how old the article is' in a user friendly format
    else if (fullDays == 1) {return "Yeserday"} 
    else if (fullHours > 1) {return fullHours + " hours ago"}
    else if (fullHours == 1) {return fullHours + " hour ago"}
    else if (fullMins > 1) {return fullMins + " mins ago"}
    else if (fullMins == 1) {return fullMins + " min ago"}
    else {return "just now"}
    };

    function initWFNews(tabId, newsObj) {   // Not a promise
    return new Promise( function(resolve, reject) {
        console.log('in initWFNews')
        try {
            var script = newsScriptWriter(newsObj)
            chrome.tabs.executeScript(tabId, {code: script}, function responseCallBack(response) {
                console.log('News changes executed...');
                resolve(response);
            });
        } catch (err) {
            alert(err);
            reject(err);
        };
    }, tabId, newsObj)
}

function newsScriptWriter(newsObj) {                // generates dynamic HTML content based on news info gathered
    let datetimeNow = new Date()                    // finding current datetime
    let script = '';
    for (let i = 0; i < newsObj.length; i++) {                                           // FOR EACH news article:
        let datetimeArticle = new Date(newsObj[i]['date'] + ' ' + newsObj[i]['time']);      
        articleAge = timeDif(datetimeNow, datetimeArticle)                              // determining 'old how the article is'
        script+="var div1          = document.createElement( 'div' );"     +             // Creating elements for each news article
                "var div2          = document.createElement( 'div' );"     +
                "var div3a         = document.createElement( 'div' );"     +
                "var img           = document.createElement( 'img' );"     +
                "var div3b         = document.createElement( 'div' );"     +
                "var div4a         = document.createElement( 'div' );"     +
                "var link          = document.createElement( 'a' );"       +
                "var title         = document.createElement( 'p' );"       +
                "var div4b         = document.createElement( 'div' );"     +
                "var text          = document.createElement( 'text' );"    +
                "var div3c         = document.createElement( 'div' );"     +

                "div1.id           = `WFDisplayBox_NewsBox_"       + i + "`;"   +       // giving all elements ids
                "div2.id           = `WFNewsBoxInner"              + i + "`;"   +
                "div3a.id          = `WFNewsBoxPhoto"              + i + "`;"   +
                "img.id            = `WFNewsBoxPhotoIMG"           + i + "`;"   +
                "div3b.id          = `WFNewsBoxTitlAndTextBoxes"   + i + "`;"   +
                "div4a.id          = `WFNewsBoxTitle"              + i + "`;"   +
                "link.id           = `WFNewsBoxTitleLink"          + i + "`;"   +
                "title.id          = `WFNewsBoxTitleLinkText"      + i + "`;"   +
                "div4b.id          = `WFNewsBoxTextBox"            + i + "`;"   +
                "text.id           = `WFNewsBoxTextBoxText"        + i + "`;"   +
                "div3c.id          = `WFNewsBoxDate"               + i + "`;"   +

                "div1.class        = `NewsBoxesWF`;" +                                  // giving all elements classes
                "div2.class        = `NewsBoxesWF`;" +
                "div3a.class       = `NewsBoxesWF`;" +
                "img.class         = `NewsBoxesWF`;" +
                "div3b.class       = `NewsBoxesWF`;" +
                "div4a.class       = `NewsBoxesWF`;" +
                "div4b.class       = `NewsBoxesWF`;" +
                "text.class        = `NewsBoxesWF`;" +
                "div3c.class       = `NewsBoxesWF`;" +

                "img.src             = `"    + newsObj[i]['img']     + "`;"  +          // injecting individual news article content (article images, url, title, descriptions..)
                "img.alt             = `Bing News Photo`;"                   +
                "link.href           = `"    + newsObj[i]['url']     + "`;"  +
                "link.target         = `_blank`;"                            +
                "title.innerHTML     = `"    + newsObj[i]['title']   + "`;"  +
                "text.innerHTML      = `"    + newsObj[i]['desc']    + "`;"  +
                "div3c.innerHTML     = `"    + articleAge            + "`;"  +

                "div1.appendChild(div2);"      +                                    // appending all elements to eachother
                "div2.appendChild(div3a);"     +
                "div3a.appendChild(img);"      +
                "div2.appendChild(div3b);"     +
                "div3b.appendChild(div4a);"    +
                "div4a.appendChild(link);"     +
                "link.appendChild(title);"     +
                "div3b.appendChild(div4b);"    +
                "div4b.appendChild(text);"     +
                "div2.appendChild(div3c);"     +
                "document.getElementById(`WFDisplayBox_News`).appendChild(div1);"    // adding the entire news article box to a box which will display all the news article boxes
            };
            return script;
}; 

function initWFImages(tabId, imagesObj) {           // generates dynnamic HTML context based on the images gathered
    return new Promise( function(resolve, reject) {
        try {
            script = ""
            for (let i = 0; i < imagesObj.length; i++) {                            // FOR EACH image:
                script += "div          = document.createElement( `div` );" +           // creates boxes 
                          "a            = document.createElement( `a` );" +
                          "img          = document.createElement( `img` );" +
                          "div.id       = `WFImagesBox" + i + "`;" +                  // adds referential names
                          "div.class    = 'ImagesBoxesWF';" +
                          "a.id         = `WFImagesLink" + i + "`;" +
                          "a.class      = `ImagesIMGLinkWF`;" +
                          "a.href       = `" + imagesObj[i][`host_url`] + "`;" +          // adds url to image location
                          "a.target     = `_blank`;" +
                          "img.id       = `WFImagesIMG" + i + "`;" +
                          "img.src      = `" + imagesObj[i][`url`] + "`;" +             // adds image src
                          "img.alt      = `Bing Images Photo`;" +
                          "img.class    = `ImagesIMGsWF`;" +
                          "a.appendChild(img);" +
                          "div.appendChild(a);" +
                          "document.getElementById(`WFDisplayBox_Images`).appendChild(div);"  // appends image to an box which displays all the images
                };
            chrome.tabs.executeScript(tabId, {code: script}, function responseCallBack(response) {      // executes the 'images script'
                resolve(response);
            });
        } catch (err) {
            reject(err);
        };
    }, tabId, imagesObj);
};

function removeLoading(tabId) {                    // removes loading screen from WF display 
    return new Promise( function(resolve, reject) {
        try {
            script = "loadDiv = document.getElementById('loaderBox');" +
            "loadDiv.style.display='none';";
            chrome.tabs.executeScript( tabId, { code: script }, function(){
                resolve();
            });
        } catch (err) {
            alert(err);
            reject(err);
        };
    }, tabId);
};

 ////////////////////////////////// Browser Changes //////////////////////////////////

chrome.runtime.onStartup.addListener(browStartProtocol());

////////////////////////////////// Contextual Menu Changes //////////////////////////////////

chrome.contextMenus.onClicked.addListener((clickData) => {            // When the context menu is clicked
    if (clickData.menuItemId == "WF"){              // if the WhereFinder button is clicked...   
        pageCheck(clickData)
            .then( (clickData) => {return fetchMousePos(clickData.selectionText)} )
                .then( (WFData) => { sendWFData(WFData); } )
            .catch( (err) => { errorAlert(err) })
       
    };   
});