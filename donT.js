// donT.js
// 2018, AKQ, https://github.com/akq/donT
// Licensed under the MIT license.
(function () {
	"use strict";

	var donT = {
		name: "donT",
		version: "1.1.1",
		templateSettings: {
			evaluate:    /\{\{([\s\S]+?(\}?)+)\}\}/g,
			interpolate: /\{\{=([\s\S]+?)\}\}/g,
			attr:        /\{\{@=([\s\S]+?)\}\}/g,
			urlEnc:        /\{\{\$=([\s\S]+?)\}\}/g,
			encode:      /\{\{!([\s\S]+?)\}\}/g,
			useParams:   /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
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

	donT.encodeHTMLSource = function(doNotSkipEncoded) {
		var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': "&#34;", "'": "&#39;", "/": "&#47;" },
			matchHTML = doNotSkipEncoded ? /[&<>"'\/]/g : /&(?!#?\w+;)|<|>|"|'|\//g;
		return function(code) {
			return code ? code.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : "";
		};
	};

	_globals = (function(){ return this || (0,eval)("this"); }());

	/* istanbul ignore else */
	if (typeof module !== "undefined" && module.exports) {
		module.exports = donT;
	} else if (typeof define === "function" && define.amd) {
		define(function(){return donT;});
	} else {
		_globals.donT = donT;
	}

	var startend = {
		append: { start: "'+(",      end: ")+'",      startencode: "'+encodeHTML(" },
		split:  { start: "';out+=(", end: ");out+='", startencode: "';out+=encodeHTML(" }
	}, skip = /$^/;


	function unescape(code) {
		return code.replace(/\\('|\\)/g, "$1");//.replace(/[\r\t\n]/g, " ");
	}
	function quote(str){	
		var plains = str.trim().split(donT.templateSettings.tag), arr=[]
			, start =-2, end = -1
			;
		for(var i=0, len=plains.length; i<len;  i++){
			var p = plains[i], plain = 0;
			if(p){
				if(p == '{{'){
					start = i;
				}
				else if(p == '}}'){
					end = i;
				}
				else if(end > start){
					p = p.replace(/'|\\/g, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r");

					arr.push(p);
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
	donT.template = function(tmpl) {
		var c = donT.templateSettings
			, cse = c.append ? startend.append : startend.split, needhtmlencode, sid = 0, indv
			, str  =  quote(tmpl)
			;
		str = ("var out='" + str
			// .replace(/'|\\/g, "\\$&") //quote the single quote and back-slash 
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
			
		str = str
			.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1')
			.replace(/\+''/g, "");

		if (needhtmlencode) {
			if (!c.selfcontained && _globals && !_globals._encodeHTML) _globals._encodeHTML = donT.encodeHTMLSource(c.doNotSkipEncoded);
			str = "var encodeHTML = typeof _encodeHTML !== 'undefined' ? _encodeHTML : ("
				+ donT.encodeHTMLSource.toString() + "(" + (c.doNotSkipEncoded || '') + "));"
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

	donT.compile = function(tmpl) {
		return donT.template(tmpl);
	};
}());
