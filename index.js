const express = require("express");
const bodyParser = require("body-parser");
const elasticsearch = require("elasticsearch");
const request = require("request-promise");
const async = require("asyncawait/async");
const await = require("asyncawait/await");

const config = require("./config.js");

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/vote", function(req, res) {
	
});

app.get("/votes/:posts", function(req, res) {
	
});

app.listen(3000, function() {
	console.log("Listening on 0.0.0.0:3000");
})