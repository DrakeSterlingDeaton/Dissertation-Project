// This script is run on every webpage on the chrome browser that allows contentScripts to run. a list of all the pages can be found
// in the manifest.json file under "content_scripts['matches']".

////////////////////////// CONTEXT MENU SCRIPTS //////////////////////////

function eventFunc(click) {
    document.removeEventListener('contextmenu', eventFunc);
    var x = click.pageX; var y = click.pageY;               // Extracts the X & Y page coordinates of the click the initiated the context menu
    var clickPos = {'x': x, 'y': y};
    eventPromise(clickPos)                      // Fufills a promise which listens for a request for the click coordinates and resolves after sending them.
    .then( () => {document.addEventListener('contextmenu', eventFunc)} )
    .catch(() => {document.addEventListener('contextmenu', eventFunc)} );
};

function eventPromise(clickPos) {
    return new Promise(function(resolve, reject) {
        try {chrome.runtime.onMessage.addListener( (msg, MessageSender, sendResponse) => {
            if (msg.action == 'WFClicked') {            // if the message from the background script is for the click coordinates, the 'action' will be "WFClicked"
                clickPos.tabId = msg.tabId;
                sendResponse(clickPos);             // sending the click data
                resolve();
            } else { reject(); };
            });
        } catch {reject(); };
    }, clickPos);
};

document.addEventListener('contextmenu', eventFunc); 

////////////////////////// WF MAIN DISPLAY SCRIPTS //////////////////////////

chrome.runtime.onMessage.addListener( (msg, MessageSender, sendResponse) => {
    if (msg.action == 'WFDisplay') {                        // if the message from the background script is for the page to initite the WF Display, the 'action' will be 'WFDisplay'
        fetch(chrome.extension.getURL('html/WFMainDisplay.html'))           // fetching relative url for the WFMainDisplay.html file
            .then(response => response.text())                              // parsing the response text
                .then(data => {document.body.innerHTML += data;} )              // appending the document html to the current page's html
                    .then( () => {sendResponse('Display initiated')})
            .catch(err => {} );
    };
});