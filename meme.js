"use strict";

var express = require('express'),
	app = express(),
	passport = require('passport'),
	session = require('express-session'),
	SteamStrategy = require('passport-steam').Strategy,
	najax = require('najax'),
	request = require('ajax-request');

passport.use(new SteamStrategy({
		returnURL: 'http://csgotradepost.com/auth/steam/return',
		realm: 'http://csgotradepost.com/',
		apiKey: '7832A4B2859DEC9695E878A312B73BED'
	}, (identifier, profile, done) => {
		process.nextTick(() => {
			profile.identifier = identifier;
			return done(null, profile);
		});
	}
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.use('/static', express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
	secret: "h880sagf9agop8Rkcp7Gug97gUGBILHVBLIS99gbJKASf9ILoveHorseCockAGsdfoUGAd9s7fhas9ofbADSb9AEDghfbAIDKBG97AdfgbOALdikgb",
	name: 'gaybotmemestradememememrmememeueeheuehuehe',
	resave: true,
	saveUninitialized: false}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
		res.render('index', {loggedin: req.isAuthenticated(), user: req.user})
	});

app.listen(80, () => {
		console.log('Example app listening on port 80!');
	});

app.get('/auth/steam',
	passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
		res.redirect('/');
	});

app.get('/auth/steam/return',
	passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
		res.redirect('/');
	});

app.get('/logout', (req, res) => {
		req.logout();
		res.redirect('/');
	});
function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.redirect('/?err=login');
}

app.get('/test', ensureAuthenticated, (req, res) => {
		res.send("YOU ARE LOGGED IN")
	});

// SteamIDs of the tradebots
var botSteamIDs = [
	"76561198267962677"
]

// Root to get all the bot inventories, returns all their items and respected prices
app.get('/botInvs', (req, res) => {
	var inventories = [];

	var pending = botSteamIDs.length;

	console.log("Looping through inventories")
	botSteamIDs.forEach((steamid, index) => {
		inventories[index] = {};

		getInventory(steamid, 1.065, Math.ceil, (success, inventory) => {
			inventories[index] = inventory;

			pending--;

			console.log(pending);
			if(pending == 0) {
				res.json({success: true, bots: inventories})
			}
		})
	})
})

function safeRequest(url, callback) {
	request(url, function(err, resp, data) {
		if(!resp.headers) {
			callback("invalid_response");
			return;
		}
		if(resp.headers.location) {
			safeRequest(resp.headers.location, callback);
		} else {
			callback(err, resp, data);
		}
	});
}

app.get('/myInv', (req, res) => {
	if(!req.isAuthenticated()) {
		return res.json({success:false, reason: "auth"});
	}

	getInventory(req.user.id, 1, Math.floor, (success, inventory) => {
		if(!success) {
			res.json({success: false, reason: inventory.Error})
		} else {
			res.json({success: success, inv: inventory});
		}
	})
})

function getInventory(steamid, price_modifier, round_fn, callback) {
		console.log(`Fetching ${steamid}`)
		if(steamid.startsWith("7656")) {
			var url = `https://steamcommunity.com/profiles/${steamid}/inventory/json/730/2`
		} else {
			var url = `https://steamcommunity.com/id/${steamid}/inventory/json/730/2`
		}
		safeRequest(url, (err, resp, body) => {
			var data = JSON.parse(body);

			if(!data.success) {
				return callback(false, data);
			}

			var inventory = data.rgInventory;
			var descriptions = data.rgDescriptions;

			var invToReturn = {};

			for(var i in inventory) {
				var item = inventory[i];
				var descID = `${item.classid}_${item.instanceid}`;
				var description = descriptions[descID];

				if(description.tradable != 0) {
					var itm = new Item(description, price_modifier, round_fn);
					if(itm.price >= 0.1) {
						invToReturn[i] =  itm;
					}
				}
			}

			callback(true, invToReturn);
		})
}

class Item {
	constructor(d, m, rfn) {
		this.market_hash_name = d.market_hash_name;
		this.icon_url = d.icon_url;
		this.quality_color = d.tags.find((tag) => {
			return tag.category_name == "Quality";
		}).color;
		this.price = rfn(priceList[this.market_hash_name] * m * 100) / 100;
	}
}

var priceList = {};

// Update the pricelist. Called when the server starts and then once every hour

function updatePriceList() {
	najax("https://api.csgofast.com/price/all", 
		(data) => {
			try {
				priceList = JSON.parse(data);
				console.log("Pricelist Loaded.")
			} catch(e) {
				console.log("Pricelist failed to load with error " + e);
				console.log(data);
				console.log("Retrying in 5 seconds...");
				setTimeout(updatePriceList, 5000);
			}
		}
	)
}

setInterval(updatePriceList, 60 * 60 * 1000);
updatePriceList();
