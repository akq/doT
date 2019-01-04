// doT.js
// 2011-2014, Laura Doktorova, https://github.com/olado/doT
// Licensed under the MIT license.
var Linter = require("eslint").Linter;
var UglifyJS = require("uglify-js");
(function (Linter, UglifyJS) {
	"use strict";

	var doT = {
		name: "doT",
		version: "1.1.1",
		templateSettings: {
			evaluate:    /\{\{([\s\S]+?(\}?)+)\}\}/g,
			interpolate: /\{\{=([\s\S]+?)\}\}/g,
			attr:        /\{\{@=([\s\S]+?)\}\}/g,
			urlEnc:        /\{\{\$=([\s\S]+?)\}\}/g,
			encode:      /\{\{!([\s\S]+?)\}\}/g,
			// use:         /\{\{#([\s\S]+?)\}\}/g,
			useParams:   /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
			// define:      /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
			defineParams:/^\s*([\w$]+):([\s\S]+)/,
			conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
			iterate:     /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
			tag: /(\{\{)([\s\S]+?(\}?)+)(\}\})/,
			varname:	"it",
			// strip:		true,
			append:		true,
			uglify: false, 
			selfcontained: false,
			comments : /\/\*[\s\S]*?\*\/|[\t ]*\/\/~.+|\/\/[^~].*\r?\n?/g, 
			doNotSkipEncoded: false
		},
		template: undefined, //fn, compile template
		compile:  undefined, //fn, for express
		log: true
	}, _globals;

	doT.encodeHTMLSource = function(doNotSkipEncoded) {
		var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': "&#34;", "'": "&#39;", "/": "&#47;" },
			matchHTML = doNotSkipEncoded ? /[&<>"'\/]/g : /&(?!#?\w+;)|<|>|"|'|\//g;
		return function(code) {
			return code ? code.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : "";
		};
	};

	_globals = (function(){ return this || (0,eval)("this"); }());

	/* istanbul ignore else */
	if (typeof module !== "undefined" && module.exports) {
		module.exports = doT;
	} else if (typeof define === "function" && define.amd) {
		define(function(){return doT;});
	} else {
		_globals.doT = doT;
	}

	var startend = {
		append: { start: "'+(",      end: ")+'",      startencode: "'+encodeHTML(" },
		split:  { start: "';out+=(", end: ");out+='", startencode: "';out+=encodeHTML(" }
	}, skip = /$^/;


	function unescape(code) {
		return code.replace(/\\('|\\)/g, "$1");//.replace(/[\r\t\n]/g, " ");
	}
	function quote(str){	
		var plains = str.trim().split(doT.templateSettings.tag), arr=[]
			, start =-2, end = -1
			;
		for(var i=0, len=plains.length; i<len;  i++){
			var p = plains[i], plain = 0;
			if(p){
				var last;
				if(p == '{{'){
					start = i;
				}
				else if(p == '}}'){
					end = i;
				}
				else if(end > start){
					// arr.push(' ');
					p = p.replace(/'|\\/g, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r");

					// var last = arr[arr.length-1];
					// if(last && last[last.length-1]=='{' && p[0] == '{'){
					// 	arr.push(' ');
					// }
					arr.push(p);
					// arr.push(' ');
					plain = 1;
				}
				else p = p.replace(/'|\\/g, "\\$&")
				if(!plain){
					arr.push(p);
				}
				
			}
		}
		return arr.join('');
	}
	doT.template = function(tmpl, c, def) {
		c = c || doT.templateSettings;
		var cse = c.append ? startend.append : startend.split, needhtmlencode, sid = 0, indv
			// str  = (c.use || c.define) ? resolveDefs(c, tmpl, def || {}) : tmpl
			, str  =  quote(tmpl)
			;
			// console.log('-------',str);	
		str = ("var out='" + (c.strip ? str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g," ")
					.replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,""): str)
			// .replace(/'|\\/g, "\\$&") //quote the single quote and back-slash to 
			.replace(c.interpolate || skip, function(m, code) {
				return cse.start + unescape(code) + cse.end;
			})
			.replace(c.attr || skip, function(m, code) {
				return cse.start + 'quoteattr('+unescape(code)+')' + cse.end;
			})
			.replace(c.urlEnc || skip, function(m, code) {
				return cse.start + 'encodeURIComponent('+unescape(code)+')' + cse.end;
			})
			.replace(c.encode || skip, function(m, code) {
				needhtmlencode = true;
				return cse.startencode + unescape(code) + cse.end;
			})
			.replace(c.conditional || skip, function(m, elsecase, code) {
				return elsecase ?
					(code ? "';}else if(" + unescape(code) + "){out+='" : "';}else{out+='") :
					(code ? "';if(" + unescape(code) + "){out+='" : "';}out+='");
			})
			.replace(c.iterate || skip, function(m, iterate, vname, iname) {
				if (!iterate) return "';} } out+='";
				sid+=1; indv=iname || "i"+sid; iterate=unescape(iterate);
				return "';var arr"+sid+"="+iterate+";if(arr"+sid+"){var "+vname+","+indv+"=-1,l"+sid+"=arr"+sid+".length-1;while("+indv+"<l"+sid+"){"
					+vname+"=arr"+sid+"["+indv+"+=1];out+='";
			})
			.replace(c.evaluate || skip, function(m, code) {
				return "';" + unescape(code) + "out+='";
			})
			+ "';return out;");
			var linter = new Linter();
			
			var messages = linter.verifyAndFix(str, {
				rules: {
					semi: 2
				}
			});
			
		str = messages.output
		// .replace(c.comments, '')	
		// .replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g," ").replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,"")
			// .replace(/\n/g, "\\n").replace(/\t/g, '\\t').replace(/\r/g, "\\r")
			.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1')
			.replace(/\+''/g, "");
			//.replace(/(\s|;|\}|^|\{)out\+=''\+/g,'$1out+=');
		// if(c.uglify){
			// var min = UglifyJS.minify(str, {
			// 	parse: {
			// 		bare_returns: true,
			// 		html5_comments: false
			// 	},
			// 	compress: false,
			// 	output: {
			// 		'inline_script': false
			// 	}
			// });
			// if(min.error){
			// 	console.log('err, ------------->', str)
			// 	throw min.error;
			// }
			// str = min.code;
			// console.log('******',str);
			// console.log(messages.output);
		// }
		if (needhtmlencode) {
			if (!c.selfcontained && _globals && !_globals._encodeHTML) _globals._encodeHTML = doT.encodeHTMLSource(c.doNotSkipEncoded);
			str = "var encodeHTML = typeof _encodeHTML !== 'undefined' ? _encodeHTML : ("
				+ doT.encodeHTMLSource.toString() + "(" + (c.doNotSkipEncoded || '') + "));"
				+ str;
		}
		try {
			return new Function(c.varname, str);
		} catch (e) {
			/* istanbul ignore else */
			if (typeof console !== "undefined") console.log("Could not create a template function: " + str);
			throw e;
		}
	};

	// doT.compile = function(tmpl, def) {
	// 	return doT.template(tmpl, null, def);
	// };
	doT.compile = function(tmpl) {
		return doT.template(tmpl);
	};
}(Linter, UglifyJS));
