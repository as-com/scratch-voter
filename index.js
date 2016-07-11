const express = require("express");
const bodyParser = require("body-parser");
const elasticsearch = require("elasticsearch");
const request = require("request-promise");
const cheerio = require("cheerio");
const crypto = require("crypto");
const async = require("asyncawait/async");
const await = require("asyncawait/await");

const config = require("./config.js");

const client = new elasticsearch.Client({
	host: config.esHost,
	log: "trace"
});
client.ping({}, function(error) {
	if (error) {
		console.error("elasticsearch is down!");
	} else {
		console.error("elasticsearch is up.");
	}
})

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

const validateRequest = async(function(id, token) {
	let comments = await (request({
		uri: "https://scratch.mit.edu/site-api/comments/project/116030344/?page=1&cachebust=" + Math.random(),
		gzip: true,
		headers: {
			"User-Agent": "comp09/scratch-voter"
		}
	}));
	let $ = cheerio.load(comments);
	let comment = $("#comments-" + id);
	if (!comment.length) {
		return false;
	}
	let hash = crypto.createHash("sha256").update(token).digest("hex");
	if (comment.find(".content").text().trim() !== hash) {
		return false;
	}
	return parseInt(comment.find(".reply").attr("data-commentee-id"));
});

app.post("/vote", async(function(req, res) {
	let user = await (validateRequest(req.body.comment_id, req.body.obj_id + "_cast_" + req.body.secret));
	if (!user) {
		res.status(400).json({
			error: "Invalid token"
		});
		return;
	}
	let search;
	try {
		search = await (client.search({
			index: "scratch-votes",
			type: "vote",
			body: {
				query: {
					bool: {
						must: [
							{
								match: {
									user_id: user
								}
							},
							{
								match: {
									type: "up"
								}
							},
							{
								match: {
									object_id: req.body.obj_id
								}
							}
						]
					}
				}
			}
		}));
	} catch (e) {
		res.status(500).json({
			error: "Server error"
		});
		return;
	}
	if (search.hits.total > 0) {
		res.status(400).json({
			error: "Already voted"
		});
		return;
	}
	client.index({
		index: "scratch-votes",
		type: "vote",
		body: {
			user_id: user,
			type: "up",
			object_id: req.body.obj_id
		}
	}, function(err, resp) {
		if (err) {
			res.status(500).json({
				error: "Server error"
			});
		} else {
			res.json({
				error: false,
				status: "Vote counted",
				user_id: user
			});
		}
	});
}));

app.post("/vote/delete", async(function(req, res) {
	let user = await(validateRequest(req.body.comment_id, req.body.obj_id + "_delete_" + req.body.secret));
	if (!user) {
		res.status(400).json({
			error: "Invalid token"
		});
		return;
	}
	client.search({
		index: "scratch-votes",
		type: "vote",
		body: {
			query: {
				bool: {
					must: [
						{
							match: {
								user_id: user
							}
						},
						{
							match: {
								type: "up"
							}
						},
						{
							match: {
								object_id: req.body.obj_id
							}
						}
					]
				}
			}
		}
	}, function(err, resp) {
		if (err) {
			res.status(500).json({
				error: "Server error"
			});
			console.error(err);
			return;
		}
		client.delete({
			index: "scratch-votes",
			type: "vote",
			id: resp.hits.hits[0]._id
		}, function(err, resp) {
			if (err) {
				res.status(500).json({
					error: "Server error"
				});
			} else {
				res.json({
					error: false,
					status: "Vote deleted",
					user_id: user
				})
			}
		});
	})
}));

app.get("/votes/:posts", function(req, res) {
	let posts = req.params.posts.split(",");
	let body = [];
	posts.forEach(function(e) {
		body.push({
			index: "scratch-votes",
			type: "vote"
		});
		body.push({
			size: 0,
			query: {
				match: {
					object_id: e
				}
			}
		});
	});
	client.msearch({
		body
	}, function(err, resp) {
		if (err) {
			res.status(500).json({
				error: "Server error"
			});
			console.error(err);
		} else {
			res.json(resp.responses.map(function(e, i) {
				return {
					obj_id: posts[i],
					count: e.hits.total
				}
			}));
		}
	});
});

app.listen(3000, function() {
	console.log("Listening on 0.0.0.0:3000");
});