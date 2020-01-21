# -*- coding: utf-8 -*-

import logging                                              # Used to aid debugging
logging.debug('beginning debug for langproFile Module script')
import spacy                                                # Used to disambiguate input text
logging.debug('beginning to load language model "en_core_web_lg"')
nlp = spacy.load('en_core_web_sm')                          # 'sm' or 'lg' libraries are availible ('lg adds a 3 sec delay to processing)
logging.debug('model loaded')
import re                                                   # Used for Reg Ex patterns
import pymysql                                              # Used to make requests to MYSQL server
from country_list import countries_for_language             # Used to disambiguate abbreviations for countires seen in DB search results
countriesDict = dict(countries_for_language('en'))          # Used to disambiguate abbreviations for states seen in DB search results
from states import states           # Used to disambiguate abbreviations for states seen in DB search results
statesDict = states.statesDict      # Used to disambiguate abbreviations for states seen in DB search results
import wikipedia                    # used for requests to wikipedia
import requests                     # used to send HTTP requests (e.g. for google HTTP GET requests)
import geocoder                     # used to find local user's Lat & Lng coordinates
from azure.cognitiveservices.search.newssearch import NewsSearchAPI         # Used to interface with Bing Api
from msrest.authentication import CognitiveServicesCredentials              # Used to interface with Bing Api
from azure.cognitiveservices.search.imagesearch import ImageSearchAPI       # Used to interface with Bing Api
from msrest.authentication import CognitiveServicesCredentials              # Used to interface with Bing Api
def initSpaCyChanges(spacyInstance):                                        # Adds custom modules to SpaCy
        """
        Adds fuctions to spaCy's 'NL processing pipeline'
        """
        def lengthChecker(doc):
            """
            After the Tokenisation module, lengthChecker ensures that the text's word count is below 20.
            If the text's length is too long, spaCy is halted, and a ValueError is raised.
            """
            inputLength = len([i for i in doc if not re.match("[^A-Za-z0-9]", i.text)])     # storing the total number of items in the input text. Using RegEx to exclude non-word items.
            try:
                assert inputLength < 10
                return doc
            except:
                raise ValueError('Your text was {} words. Please shorten your input text to under 10 words.'
                .format(inputLength))
        spacyInstance.add_pipe(lengthChecker, first=True)
initSpaCyChanges(nlp)          # adding spacy custom modules here  

######################## LANG PRO CLASS ##########################################

class langpro:
    def __init__(self, txt):    
        """
        Initiasing langPro.
        Passing in input text, & instance of spacy module.
        """
        self.txt = txt
        self.initVars() 

    def initVars(self):
        # input text dictionary
        self.loc = {'GCS':[], 'label':'', 'input':'', 'locBase': '','ownLoc': geocoder.ip('me').latlng, 'runQueryU': False, 'DBSearchResults': []}                # dictionary storing all location details about input text
        # NLP vars
        self.checker = r'((?i)[+-]?\d{1,2}[^BCDFGI-MPQV-Z]*?(?=(?<![A-Z]))[NSEW])'   #RE to check for GCS
        self.degRE, self.charCountRE = r'(\d{1,2}(\.\d+)?)', r'[A-Za-z]'          #for extracting degrees & counting alphanumeric chars
        self.labelCheck = ['ORG', 'GPE', 'LOC']      # storing list of appropriate named entity labels
        # Geolocations DB vars
        self.DBDict = {'RE':'Region', 'CI':'Town', 'CO':'Country'}          # dictionary for DB abbreviations
        self.searchResults = []                                             # list for the processed DB search results
        self.DBSearch = []                                          # list for the unprocessed DB search results
        self.SQLRegEx1, self.SQLRegEx2, self.SQLRegEx3 = r'^[US]', r'^\w\w[-]..', r'\w\w'   # RExpressions for DB abbreviation parsing
        self.numOfResults = None                                    # number of search results
        self.con = self.connectDB()
        # API vars    
        self.bingNewsClient = NewsSearchAPI(CognitiveServicesCredentials('********************************'))        # bing key might also be this one: 1a10e4dc6c2a4c91a5753ed71f20a1eb (key2)
        self.bingImagesClient = ImageSearchAPI(CognitiveServicesCredentials('********************************'))
        self.wikiReg = r'^.*\n(?=\n*\=)'                 # RegEx to scrap the summary section of the wiki page matching the input text
       
    def initNLP(self):
        """
        initializing NLP functions for language processes & keyword extraction
        """
        doc = nlp(self.txt)                      # creating spacy object from input text
        if self.GCSChecker(self.txt) == False:     # checking to see if input text is a GCS input, if it isnt, then:
            self.locationGetter(doc)            # extracting the location info from the input text
        return(self.loc)

    def GCSChecker(self, txt):
        """
        After the NER Module has extracted the text's Named Entities, GCSChecker checks if the
        NE's are lat/long coordinates. If they are, the coordinates are stored sepertely, & the
        function returns True, else it returns false.
        """
        if (re.search(self.checker, txt)):                 # checking if input string has GCS matches
            matches = re.findall(self.checker, txt)              # if it does, creating a list with all matches
            for m in matches:                               # iterating over matches                                 
                if len(re.findall(self.charCountRE, m)) == 1:        #ensuring that the match only has a single alphanumeric char (perhaps an unnessecary step)
                    self.loc['GCS'].append(m)
                if len(self.loc['GCS']) == 2:                        #lat & long are only 2 coords, so there's no need to look at any further matches
                    li = self.loc['GCS']                            # ^^ although there's a chance they may still not be a match (more checks are done below)
                    break                                  # breaking loop
        if 'li' in locals():                              # will only enter this loop for lat & longs were identified & saved above
            if (re.match(r'[NnSs]', li[0][-1])) and (re.match(r'[EeWw]', li[1][-1])):           # checking that the coords are following proper lat/long coordinate ordere (lat first, then long) 
                degs = list(map(float, [re.search(self.degRE, li[0]).group(), re.search(self.degRE, li[1]).group()]))     # saving the degrees specifically from the lat & long
                if (-90<=degs[0]<=90) and (-180<=degs[1]<=180):                     # testing that the degrees fall within the correct range
                    self.loc['GCS'], self.loc['locBase'] = li, 'GCS'
                    return True
        return False

    def locationGetter(self, doc):
        """
        locationGetter asserts that the text contains a geographical location, and if so, 
        it stores the location seperately. If no location is found, a NameError is raised.
        """
        try:
            label = doc.ents[0].label_              # storing first named entity label
            assert label in self.labelCheck          # asserting that the NE is in the list of appropriate labels
            self.loc['input'], self.loc['label'], self.loc['locBase'] = doc.ents[0].text, label, label
            return doc
        except AssertionError:
            raise AssertionError("There's been an error. Please try a different input")
        except: 
            return doc

    def locGetCheck(self):
        """
        Checks if the location dictionary (where all info on an input texts extracted
        location is stored) is empty. Raises an error if it is empty.
        """
        try:
            locCheckDict = self.loc
            del locCheckDict['ownLoc']
            any(locCheckDict) == True   # as long as any of the values in the dictionary have been added, then finding a location from the input is possible 
            return self.loc['locBase']
        except:
            raise NameError("Ambiguity error. Please try different input text")
    
    def connectDB(self):
        connection = pymysql.connect(host='localhost',
                            port=3306,
                            user='drdeato',
                            password='',
                            db='LocationsDB',
                            charset='utf8mb4',
                            cursorclass=pymysql.cursors.DictCursor)
        return connection

    def initDBSearch(self, locBase):
        """
        Determines if & executes functions that search the DB for information related to the 
        input text.
        """
        if locBase == 'GCS' or locBase == 'LOC': 
            return                          # no search needed of the named entity is a LOC of GCS
        else:
            self.connectDB()
            self.pyMySQLSearch()            # searches the database for matches to the named entity
            self.evalResults(locBase)         # evaluates how the DB search results impacts whether or not the user should be queried
            self.processResults(self.DBSearch)      # Processes the DB results into a simplier format

    def pyMySQLSearch(self):
        """
        Sends a request to the DB based on the user input.
        """
        if self.loc['input'] == '': self.loc['input'] = self.txt
        try:
            with self.con.cursor() as cursor:
                request =   """
                            SELECT iso, local_name, type
                            FROM meta_location 
                            WHERE local_name RLIKE %s
                            """
                cursor.execute(request, (self.loc['input']))
                self.DBSearch = cursor.fetchall()
        finally:
            self.con.close()

    def evalResults(self, searchType):
        """
        Determines if additional querries need to be given to the user based on the amount
        of results generated by the database search.
        """
        self.numOfResults = len(self.DBSearch)      # counting the number of results
        if self.numOfResults == 0:      # if there are no search results
                raise ValueError("No match found for '{}'".format(self.loc['input'])) 
        if self.numOfResults == 1:      # if there's only one search result
                self.loc['runQueryU'] = True           # SINGLE RESULT IS THE CORRECT PLACE                                    COME BACK WHEN ALL SEARCH RESULTS ARE KNOWN
        if self.numOfResults > 1:       # if there's multiple search results
                self.loc['runQueryU'] = True

    def processResults(self, results):
        """
        Simplies the search results into a more usable format.
        """
        try: 
            for i in range(self.numOfResults):
                iso = results[i]['iso']
                if re.match(self.SQLRegEx1, iso):
                    iso = re.match(self.SQLRegEx2, iso).group()
                    isoState = statesDict[iso[3:5]]
                    iso = isoState + ', USA'
                else:
                    iso = re.match(self.SQLRegEx3, iso).group()
                    iso = countriesDict[iso]
                self.searchResults.append({'resultNum':i, 'iso':iso, 
                'localName':results[i]['local_name'].replace('\r', ''), 
                'geoType':self.DBDict[results[i]['type']]})
        except Exception:
            pass
        self.loc['DBSearchResults'] = self.searchResults

    def resultsListGen(self):
        """
        Generates a list of options based on the search results.
        """
        for i in range(self.numOfResults):
            a, b, c = self.searchResults[i]['localName'], self.searchResults[i]['geoType'], self.searchResults[i]['iso']
            yield '{0}: {1}({2}), {3}.\n'.format(str(i), a, b, c)

    def initGoogleAPI(self):
        """
        """
        self.prepParams()
        self.prepURL()
        self.placeIDFetch()

    def prepParams(self):
        """
        Prepares the parameters that have been gathered by storing them
        as strings to be inserted as the URL's endpoint query
        """
        if self.loc['locBase'] == 'GCS':
            pass                                        # don't need to do anything because google place search ID isn't needed for GCS coordinates
        elif self.loc['locBase'] == 'GPE':
            self.loc['params'] = '{0}%{1}%'.format(self.loc['inputFull'].replace(' ', '%'), self.loc['iso'].replace(' ', '%'))   
        else:
            self.loc['params'] = '{0}'.format(self.loc['inputFull'].replace(' ', '%'))                               

    def prepURL(self):
        """
        Creates a URL for the google API that's built dependant on the query that's needed.
        """
        if self.loc['locBase'] == 'GCS':
            return
        url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?'      # parameters
        key = 'key=****************************************'                            # My Google Cloud API key
        i = 'input={}'.format(self.loc['params'])                                       # input text
        self.loc['placeReqURL'] = '&'.join([url,key,i,'inputtype=textquery'])           # Creating and storing the URL
        self.loc['googleKey'] = key

    def placeIDFetch(self):
        """
        Sends placeID request to Google, and stores the placeID from the response
        """
        try:
            r = requests.get(url = self.loc['placeReqURL']) 
            data = r.json()
            self.loc['placeID'] = data['candidates'][0]['place_id']
        except: pass

    def initOtherAPIs(self):
        """
        Executes functions which perform API requests to Wikipedia and Bing
        """
        self.wikiFetch()
        self.newsFetch()
        self.imagesFetch()
        
    def wikiFetch(self):
        """
        Fetches data from Wikipedia.
        """
        s = wikipedia.search(self.loc['inputFull'])             # assigning the var 's' to the results from a wikipedia search for pages that match our 'input'
        for i in range(len(s)):                             # iterating over our search results
            try:
                wiki = {}
                wikiPage = wikipedia.page(s[i]) # Assigning a wiki search result to the var 'page'. Note: some search results aren't pages (i.e. often the first search result isn't a page) so they will cause a 'disambiguation error'
                wiki['wikiPage-url'] = wikiPage.url
                wiki['wikiPage-img'] = wikiPage.images[0]          # Extracts the first picture from the wikipedia page
                wiki['wikiPage-title'] = wikiPage.title
                wiki['wikiPage-sum'] = re.search(self.wikiReg, wikiPage.content).group()        # Executing RegEx to match the summary text
                wiki['wikiPage-sum'] = re.sub(r"\.(?=\w+)", ".<br><br>", wiki['wikiPage-sum'])  # checks text for any dots followed immediately by text. This pattern only occurs at the start of new paragraphs.
                self.loc['wiki'] = wiki
                break                                    # if a page has been correctly assigned, then there's no need to continue the loop, so it's broken.
            except: 
                pass
        
    def newsFetch(self):
        """
        Uses Bing API to search for news articles associated with the input text
        """
        try:
            news = self.bingNewsClient.news.search(query=self.loc['inputFull'], market='en-us', count = 25)     # sending query to bing, saving response
            assert news.value                               # ensuring response has a value
            newsDictLi = []
            for i, newsObj in enumerate(news.value):
                try:
                    newsDict =  {
                                'newsNum'   :    i, 
                                'url'       :    newsObj.url,
                                'title'     :    newsObj.name,
                                'desc'      :    newsObj.description,
                                'date'      :    re.search(r'\d.*(?=T)', newsObj.date_published).group(),
                                'time'      :    re.search(r'(?<=T).*(?=\.)', newsObj.date_published).group(),
                                'img'       :    newsObj.image.thumbnail.content_url,
                                'imgWidth'  :    newsObj.image.thumbnail.width,
                                'imgHeight' :    newsObj.image.thumbnail.height
                                }
                    newsDictLi.append(newsDict)
                except: continue
            self.loc['news'] = newsDictLi                      # saving the images to loc dict
        except:
            self.loc['news'] = None                 

    def imagesFetch(self):
        """
        Uses Bing API to search for images associated with the input text.
        """
        try:
            images = self.bingImagesClient.images.search(query=self.loc['inputFull'], count = 40)                    # sending query to bing, saving response
            assert images.value                         # ensuring response has a value
            imageDictLi = []
            for i, imageObj in enumerate(images.value):
                try:
                    imageDict = {
                                'imgNum'    :    i, 
                                'url'       :    imageObj.thumbnail_url,
                                'host_url'  :    imageObj.host_page_url,
                                'imgWidth'  :    imageObj.width,
                                'imgHeight' :    imageObj.height 
                                }
                    imageDictLi.append(imageDict)
                except: continue
            self.loc['images'] = imageDictLi                      # saving the images to loc dict
        except:
            self.loc['images'] = None

    def getLocDetails(self):
        self.loc['ownLoc'] = geocoder.ip('me').latlng
        if self.loc['input'] == '':
            self.loc['input'] = self.txt
        return self.loc
    
    def putLocDetails(self, locDetails):
        self.loc = locDetails





