#Validation Tracker



##Installation Instructions:

1. Install [node.js and npm](http://nodejs.org/).
2. Install dependencies with ```sudo npm install```.
3. Create a config.js file using the config.js.example file with the credentials you need.

4. Run ``` node remote.js``` on any rippled machines that you want to parse the rippled logs for validation confirmations.
5. Run ``` node app.js``` on the machine that you want to talk to the database and run the api.

##Usage Instructions:

```/health``` will print the health of all the validators in the database throughout all time in json format.

```/health/display``` will display the health of all the validators in the database throughout all time with an option to add to and from filters.

In order to add filters you can add ```/from/to``` to the url where the format of each date is yyyymmddhhmmss. 
For example ```/health/20130101000000/20141204000000``` would display the json data of all the validators from _Jan. 1st, 2013_ to _Dec. 4th, 2014_.