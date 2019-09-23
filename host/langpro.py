#!/usr/local/opt/python3/libexec/bin/python

# This script communicates with WhereFinder's 'background.js' script via chrome's Native Messaging protocol,
# which allows for stdin/stdout communication to other scripts.

import logging                                                              # Used to aid debugging
logging.basicConfig(filename='tmp3.log',
                    format='%(levelname)s %(asctime)s :: %(message)s',
                    level=logging.DEBUG)
logging.debug('beginning debug for langpro app')

import sys                                                                  # Used to access system module functions (as seen in next line)
sys.path.extend(['/Users/Drake/anaconda3/lib/python3.6/site-packages',         
'/Users/Drake/miniconda3/lib/python37.zip', '/Users/Drake/miniconda3/lib/python3.7',
'/Users/Drake/miniconda3/lib/python3.7/lib-dynload', '/Users/Drake/.local/lib/python3.7/site-packages', 
'/Users/Drake/miniconda3/lib/python3.7/site-packages'])                      # Adding additional module location paths which python wasn't checking when program was initiated via javascript
import struct                                                               # Used 
import json                                                                 # Used to pack * unpack JSON
import time                                                                  # Used to create delay for two allow for NLP loading
import langproModule                                                        # Importing libraries ran from langproModule 
from langproModule.langproFile import langpro                               # Importing langpro class

############################################################################  FUNCTIONS ############################################################################ 

def msgCounter():
    """
    increments message counter, or initializes the counter if it doesn't exist
    """     
    global msgNum     
    try: msgNum += 1                    # trying to add to msgNum
    except NameError:                   # if msgNum doesn't exist yet,
        time.sleep(10)                       # waiting for 10 seconds
        msgNum = 0         # initializing the msgNum var
    return msgNum

def unpackMsg(incom_msg_bytes):
    """
    unpacks the JSON msg from the pipe and creates a dictionary from it
    """
    incom_length = struct.unpack('i', incom_msg_bytes)[0] # using bytes data to find the total number of chars from the message     
    incom_msg_json = json.loads(sys.stdin.read(incom_length))         # loading incomming message as json
    incom_msg_dict = dict(incom_msg_json)                           # creates dictionary of json msg
    return incom_msg_dict

def processMsg(incom_msg_dict, msgType):
    """
    Chooses which type of processes needs to be done on the incomming msg dictionary, 
    returns a function that executes the msg processing
    """
    if msgType == 'out_req':                    # if the msg type is an outgoing request for info on input text...
        return processMsgReq(incom_msg_dict)
    if msgType == 'out_query':                # if the msg type is a confirmation of info...
        return processMsgReqMore(incom_msg_dict)

def processMsgReq(msg_dict):
    """
    takes the input text and runs NLP & SQL protocols.
    returns the packaged up results
    """
    incom_msg_txt = msg_dict['text']                        # extracting the text from the dictionary
    processedText = langpro(incom_msg_txt)                          # creating instance of language processor class
    processedText.initNLP()                                             # running NLP protocols on the input text
    processedText.initDBSearch(processedText.locGetCheck())                     # running SQL queries on the input information
    return processedText                                                    #returning a dictionary with all the text processing

def selectResult(textObj, resultNumAns):
    """
    Iterating over DBSearchResults to match the search result number
    with the search result number that the user chose
    """
    for result in textObj['DBSearchResults']:
        if str(result['resultNum']) == str(resultNumAns):
            return result

def processMsgReqMore(incom_msg_dict):
    """
    takes the partially processed text and performs additional
    protocols to fetch more specific information about the text
    """
    textObj = incom_msg_dict['processedText']
    textObj['DBSearchResults'] = [selectResult(textObj, incom_msg_dict['queryAns'][0][-1])]  # for the 2nd input... choosing the numerical value associated with the correct search result
    textObj['iso']          =       textObj['DBSearchResults'][0]['iso']                # Saving info specifically from that search result
    textObj['localName']    =       textObj['DBSearchResults'][0]['localName']         
    textObj['geoType']      =       textObj['DBSearchResults'][0]['geoType']           
    textObj['inputFull']    =       textObj['localName'] + ', ' + textObj['iso']       
    
    def createUpdatedLangpro(textObj):
        """
        Initializing new langpro instance so that additional processing
        can be done on the same input text. (new initialisation is needed
        as the previous langpro instance is in a different scope)
        """
        processedText = langpro(textObj['input'])                                       # initializing langpro
        processedText.putLocDetails(textObj)                                            # updating langpro details with the textObj details
        return processedText
    processedText = createUpdatedLangpro(textObj)       
    processedText.initGoogleAPI()                       # Using other langPro modules 
    processedText.initOtherAPIs()
    return processedText

def sendMsg(msgDict, msgTypeIn):
    """
    packages up all the text as a JSON object and writes the object to the stream
    """
    out_msg = json.dumps({'textObj': (msgDict), 'msgTypeIn': msgTypeIn}, separators=(',', ':'))        #The text to send back to the app.
    sys.stdout.buffer.write(struct.pack('I', len(out_msg)))           # Tell pipe how long the message is.
    sys.stdout.write(out_msg)                                           # Write message to pipe 

def typeChooser(msg_dict):
    """
    Uses the number of SQL search results to determine if the subject
    of the text is ambiguous or not. returns a string with this information.
    """
    if len(msg_dict['processedText']['DBSearchResults']) > 1:
        return 'in_query'
    else: 
        return 'in_ans'

############################################################################  NATIVE MESSAGING SCRIPT ############################################################################ 

while True:
    try:
        msgNum = msgCounter()                               # adding to counter 
        incom_msg_bytes = sys.stdin.buffer.read(4)                  # The first four bytes from the app state the rest of the message's length.
        if incom_msg_bytes != b'':                          # if byte data has been written to stdin pipe...
            msg_dict = unpackMsg(incom_msg_bytes)           # unpacking msg from stream and saving it in dictionary
            msg_dict['processedText'] = processMsg(msg_dict, msg_dict['type']).getLocDetails() 
            msg_dict['msgTypeIn'] = typeChooser(msg_dict)               # creating label for dictionary to be interpreted by front-end JS
            sendMsg(msg_dict, msg_dict['msgTypeIn'])                    # packaging and writing message to stream
            sys.stdout.flush()
            #sys.exit() 
    except Exception as ex:
        sys.stdout.flush()
        sys.exit(ex)