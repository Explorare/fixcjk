// ==UserScript==
// @name              FixCJK!
// @name:zh-CN        “搞定”CJK！
// @namespace         https://github.com/stecue/fixcjk
// @version           0.15.108
// @description       1) Use real bold to replace synthetic SimSun bold; 2) Regular SimSun/中易宋体 can also be substituted; 3) Reassign font fallback list (Latin AND CJK). Browser serif/sans settings are overridden; 4) Use Latin fonts for Latin part in Latin/CJK mixed texts; 5) Fix fonts and letter-spacing for CJK punctuation marks.
// @description:zh-cn 中文字体和标点设定及修正脚本
// @author            stecue@gmail.com
// @license           GPLv3
// @match             http://*/*
// @match             https://*/*
// @match             file:///*
// @exclude           https://*jsfiddle.net*/*
// @grant             GM_addStyle
// ==/UserScript==
(function () {
    'use strict';
    // You can change the the following fonts/settings until the "var FixPunct=" line.
    var CJKdefault = '"Microsoft YaHei",SimSun,"WenQuanYi Zen Hei Sharp","WenQuanYi Micro Hei"'; //The default CJK font if no sans or serif is specified. Regular weight.
    var CJKSimSun= '"Microsoft YaHei","WenQuanYi Micro Hei"'; //Fonts to replace SimSun;
    var CJKserif = '"Microsoft YaHei","WenQuanYi Micro Hei"'; //Default serif fonts for CJK. Although It is intended for regular weight but some element with bold weight still use the font here. Therefore "SimSun" itself is not a good choice because it does not have a real bold font.
    var CJKsans = '"Microsoft YaHei","Noto Sans CJK SC"'; //Sans-serif fonts for CJK. Regular weight.
    var CJKBold = '"Microsoft YaHei","WenQuanYi Micro Hei"'; //The "good CJK font" to replace SimSun bold. Note that some elements still use font in CJKserif defined above such as the menus on JD.com.
    var CJKPunct = 'Noto Sans CJK SC,"WenQuanYi Micro Hei",SimHei,SimSun'; //The font to use for CJK quotation marks.
    var LatinInSimSun = 'Ubuntu Mono'; //The Latin font in a paragraph whose font was specified to "SimSun" only.
    var LatinSans = 'Lato,"Open Sans",Arial'; //Sans-serif fonts for Latin script. It will be overridden by  a non-virtual font in the CSS font list if present.
    var LatinSerif = 'Constantia,"Liberation Serif","Times New Roman"'; //Serif fonts for Latin script. It will be overridden by  a non-virtual font in the CSS font list if present.
    var LatinMono = 'Consolas,"DejaVu Sans Mono"'; //Monospace fonts for Latin script. It will be overridden by  a non-virtual font in the CSS font list if present.
    var FixRegular = true; //Also fix regular fonts. You need to keep this true if you want to use "LatinInSimSun" in Latin/CJK mixed context.
    var FixMore = true; //Appendent CJK fonts to all elements. No side effects found so far.
    var FixPunct = true; //If Latin punctions in CJK paragraph need to be fixed. Usually one needs full-width punctions in CJK context. Turn it off if the script runs too slow or HTML strings are adding to your editing area.
    var useJustify = true; //Make justify as the default alignment.
    ///=== "Safe" Zone Ends Here.Do not change following code unless you know the results! ===///
    var timeOut=3000; //allow maximum 3.0 seconds to run this script.
    var maxlength = 1100200; //maximum length of the page HTML to check for CJK punctuations.
    var maxNumElements = 81024; // maximum number of elements to process.
    var CJKOnlyThreshold = 11024; // Only CJK if the number of elements reaches this threshold.
    var loopThreshold = 8192;
    var noBonusLength = 11024; //no bonus functions such as fixing "reversed" pairs.
    var noBonusTimeout = 20; //Longest time (in ms) to run bonus functions for each element.
    var sqz_timeout=50; // 50ms per element seems long enough.
    var invForLimit=6; //the time limit factor (actual limit is timeOut/invForLimit) for the "for loop" in Round 2 & 3.
    var processedAll=true;
    var ifRound1=true;
    var ifRound2=true;
    var ifRound3=true;
    var debug_verbose = false; //show/hide more information on console.
    var debug_00 = false; //debug codes before Rounds 1/2/3/4.
    var debug_01 = false; //Turn on colors for Round 1.
    var debug_02 = false;
    var debug_03 = false;
    var debug_04 = false;
    var debug_re_to_check = false; //"true" might slow down a lot!
    var debug_spaces = false;
    var debug_wrap = false;
    var debug_tagSeeThrough= false;
    var useWrap=true;
    var useRemoveSpacesForSimSun=false;
    var useFeedback=false;
    var useCSSforSimSun=false;
    var useDelayedFix=false;
    var useLoop=false;
    var useSFTags=false; //FIXME: use tags may cause problems on jd.com.
    var re_to_check = /^\uEEEE/; //use ^\uEEEE for placeholder. Avoid using the "m" or "g" modifier for long document, but the difference seems small?
    ///=== The following variables should be strictly for internal use only.====///
    var refixing=false;
    var refixingFonts=false;
    var rspLength=3; //If the font-list reaches the length here, the author is probably responsible enough to cover most Latin/English environment.
    var waitForDoubleClick=200;
    var SkippedTagsForFonts=/^(TITLE|HEAD|BODY|SCRIPT|noscript|META|STYLE|AUDIO|video|source|AREA|BASE|canvas|figure|map|object|textarea)$/i;
    var SkippedTagsForMarks=/^(TITLE|HEAD|SCRIPT|noscript|META|STYLE|AUDIO|video|source|AREA|BASE|canvas|figure|map|object|textarea|input|code|pre|tt|BUTTON|select|option|label|fieldset|datalist|keygen|output)$/i;
    var SkippedTags=SkippedTagsForFonts;
    //var SafeTags=/^(B|STRONG|EM|H[123456]|U|VAR|WBR)$/i; //Safe tags as subelements. They do not need to meet the "no class && no tag" criterion.
    var SafeTags=/^\uE911forCompatibilityOnly$/g;
    var upEnoughTags=/^(P|LI|TD|BODY)$/g;
    var ignoredTags=/^(math)$/i;
    var enoughSpacedList='toggle-comment,answer-date-link'; //Currently they're all on zhihu.com.
    var CJKclassList='CJK2Fix,MarksFixedE135,FontsFixedE137,\uE985,\uE211,Safe2FixCJK\uE000,PunctSpace2Fix,CJKVisited,SimSun2Fix,LargeSimSun2Fix,\uE699,checkSpacedQM,wrappedCJK2Fix';
    var re_autospace_url=/zhihu\.com|guokr\.com|changhai\.org|wikipedia\.org|greasyfork\.org|github\.com/;
    var preCodeTags='code,pre,tt';
    var t_start = performance.now();
    var t_stop = t_start;
    var re_simsun = / *simsun *| *宋体 *| *ËÎÌå *| *\5b8b\4f53 */gi;
    var all = document.getElementsByTagName('*');
    var NumAllDOMs=all.length;
    var bodyhtml=document.getElementsByTagName("HTML");
    if (bodyhtml[0].innerHTML.length > maxlength) {
        console.log('FixCJK!: HTML too long, skip everything. Exiting now...');
        ifRound1=false;
        ifRound2=false;
        ifRound3=false;
        FixPunct=false;
    }
    //Note that if one prefers using pure Latin punctuation for CJK contents, I'll leave it untouched. (maybe in 0.10.x)
    //else if (!(bodyhtml[0].innerHTML.match(/[\u3000-\u303F\uFF00-\uFFEF]/m))) {
    else if (!(bodyhtml[0].innerHTML.match(/[\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF]/))) {
        if (debug_verbose===true) {console.log('FixCJK!: Checking for CJK took '+((performance.now()-t_stop)/1000.0).toFixed(3)+' seconds. No CJK found.');}
        if (debug_verbose===true) {console.log('FixCJK!: No need to check CJK punctuations.');}
        FixPunct=false;
    }
    else {
        if (debug_verbose===true) {console.log('FixCJK!: Checking for CJK took '+((performance.now()-t_stop)/1000.0).toFixed(3)+' seconds. CJK found.');}
        FixPunct=true;
    }
    var sig_sim = 'RealCJKBold\u0020易'; //Just for SimSun;
    var sig_song = 'RealCJKBold\u0020宋'; // signature to check if change is sucssful or not.
    var sig_hei = 'RealCJKBold\u0020黑'; // signature to check if change is sucssful or not.
    var sig_bold = 'RealCJKBold\u0020粗'; // signature to check if change is sucssful or not.
    var sig_default = 'RealCJKBold\u0020默'; // signature to check if change is sucssful or not.
    var sig_mono= 'RealCJKBold\u0020均';
    var sig_punct = '\uE135'; //will be attached to CJKPunct; This is used in punct fixing not font fixing(?)
    var qsig_sim = '"' + sig_sim + '"'; //Quoted sinagure; Actually no need to quote.
    var qsig_song= '"'+sig_song+'"';
    var qsig_hei = '"' + sig_hei + '"'; //Quoted sinagure;
    var qsig_bold = '"' + sig_bold + '"';
    var qsig_default = '"' + sig_default + '"';
    //var qpreCJK = '"' + CJKdefault + '"'; //Quoted "CJK font".
    var genPunct='General Punct \uE137'; //Different from sig_punct
    var qpreCJK = CJKdefault;
    var qCJK = LatinInSimSun + ',' + CJKdefault + ',' + qsig_default;
    var qSimSun = qsig_sim+','+LatinInSimSun + ',' + CJKSimSun;
    var qLargeSimSun = qsig_sim+','+ LatinSerif + ',' + 'SimSun';
    var qBold = LatinInSimSun + ',' + CJKBold + ',' + qsig_bold;
    var qsans = LatinSans + ',' + CJKsans + ',' + qsig_hei + ',' + 'sans-serif'; //To replace "sans-serif"
    var qserif = LatinSerif + ',' + CJKserif +','+qsig_song+ ',' + 'serif'; //To replace "serif"
    var qmono = sig_mono+','+LatinMono + ',' + CJKdefault + ',' + qsig_default + ',' + 'monospace'; //To replace "monospace".
    var i = 0;
    var max = all.length;
    var child = all[i].firstChild;
    var if_replace = false;
    var font_str = window.getComputedStyle(all[i], null).getPropertyValue('font-family');
    var fweight = window.getComputedStyle(all[i], null).getPropertyValue('font-weight');
    var re_sans0 = /^ ?sans ?$|^ ?sans-serif ?$/i;
    var re_serif = /^ ?serif ?$/i;
    var re_mono0 = /^ ?mono ?$|^ ?monospace ?$/i;
    //letter-spacing options
    var kern_consec_ll='-0.35em'; //。” or ））
    var kern_consec_rr='-0.35em'; //（（
    var kern_consec_lr='-0.8em'; //）（
    var kern_ind_open='-0.25em';
    var kern_ind_close='-0.25em';
    //Check if the font definitions are valid
    if (check_fonts(CJKdefault, 'CJKdefault') === false)
        return false;
    else if (check_fonts(CJKserif, 'CJKserif') === false)
        return false;
    else if (check_fonts(CJKsans, 'CJKsans') === false)
        return false;
    else if (check_fonts(CJKBold, 'CJKBold') === false)
        return false;
    else if (check_fonts(LatinInSimSun, 'LatinInSimSun') === false)
        return false;
    else if (check_fonts(LatinSans, 'LatinSans') === false)
        return false;
    else if (check_fonts(LatinSerif, 'LatinSerif') === false)
        return false;
    else if (check_fonts(LatinMono, 'LatinMono') === false)
        return false;
    else {
    }
    if (debug_00===true) {console.log(dequote('"SimSun","Times New Roman"""""'));}
    //Assign fonts for puncts:
    var punctStyle='@font-face { font-family: '+genPunct+';\n src: '+AddLocal(CJKPunct)+';\n unicode-range: U+3000-303F,U+FF00-FFEF;}';
    punctStyle=punctStyle+'\n@font-face {font-family:RealCJKBold\u0020易;\n src:local(SimHei);\n unicode-range: U+A0-2FF,U+2000-2017,U+201E-2FFF;}';
    if (useCSSforSimSun===true) {
        punctStyle=punctStyle+'\n @font-face { font-family: SimSun;\n src: local('+FirstFontOnly('SimSun')+');\n unicode-range: U+3400-9FBF;}';
        punctStyle=punctStyle+'\n @font-face { font-family: 宋体;\n src: local('+FirstFontOnly('SimSun')+');\n unicode-range: U+3400-9FBF;}';
        punctStyle=punctStyle+'\n @font-face { font-family: ËÎÌå;\n src: local('+FirstFontOnly('SimSun')+');\n unicode-range: U+3400-9FBF;}';
        punctStyle=punctStyle+'\n @font-face { font-family: 宋体;\n src: local('+FirstFontOnly(LatinInSimSun)+');\n unicode-range: U+0000-2C7F;}';
    }
    if (debug_00===true) console.log(punctStyle);
    GM_addStyle(punctStyle);
    ///----------------------------
    qpreCJK = dequote(qpreCJK);
    qCJK = dequote(qCJK);//LatinInSimSun + ',' + CJKdefault + ',' + qsig_default;
    qSimSun = dequote(qSimSun);//LatinInSimSun + ',' + CJKserif + ',' + qsig_sun;
    qLargeSimSun = dequote(qLargeSimSun);//LatinInSimSun + ',' + CJKserif + ',' + qsig_sun;
    qBold = dequote(qBold);//LatinInSimSun + ',' + CJKBold + ',' + qsig_bold;
    qsans = dequote(qsans);//LatinSans + ',' + CJKsans + ',' + qsig_hei + ',' + 'sans-serif'; //To replace "sans-serif"
    qserif = dequote(qserif);//LatinSerif + ',' + CJKserif + ',' + qsig_sun + ',' + 'serif'; //To replace "serif"
    qmono = dequote(qmono);//LatinMono + ',' + CJKdefault + ',' + qsig_default + ',' + 'monospace'; //To replace "monospace".
    CJKPunct=dequote(CJKPunct)+','+sig_punct;
    if (debug_00===true) {console.log('Entering Loops...');}
    /// ===== Labeling CJK elements === ///
    t_stop=performance.now();
    function addTested (node) {
        var child=node.firstChild;
        while (child) {
            if (child.nodeType===1) {
                addTested(child);
            }
            child=child.nextSibling;
        }
        if (node.classList.contains("CJKVisited")) {
            return true;
        }
        else {
            if (node.textContent.length>5) //make sure it is not empty.
                node.classList.add("CJKVisited");
            return true;
        }
    }
    function labelCJK() {
        var t_stop=performance.now();
        var all=document.getElementsByTagName("*");
        for (var i=0;i < all.length;i++) {
            if (performance.now()-t_stop>1000) {console.log("FIXME: Too slow. Stopped @"+all[i].nodeName+"#"+i.toString());break;}
            if ((all[i].nodeName.match(SkippedTags)) || all[i] instanceof SVGElement || all[i].classList.contains("CJKVisited")){
                continue;
            }
            all[i].classList.add("CJKVisited");
            font_str=dequote(window.getComputedStyle(all[i], null).getPropertyValue('font-family'));
            if (debug_01===true) console.log(font_str);
            if (font_str.match(re_simsun)) {
                var font_size=(window.getComputedStyle(all[i], null).getPropertyValue('font-size')).slice(0,-2);
                if (font_size < 18) {
                    all[i].classList.add("CJK2Fix");
                    all[i].classList.add("SimSun2Fix");
                    if (!inTheClassOf(all[i],enoughSpacedList)) {
                        all[i].classList.add("PunctSpace2Fix");
                    }
                }
                else {
                    all[i].style.fontFamily=font_str;
                    all[i].classList.add("CJK2Fix");
                    all[i].classList.add("LargeSimSun2Fix");
                    if (!inTheClassOf(all[i],enoughSpacedList)) {
                        all[i].classList.add("PunctSpace2Fix");
                    }
                }
                continue;
            }
            if ( !(all[i].textContent.match(/[“”‘’\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF]/)) && (font_str.split(',').length >= rspLength) ){
                all[i].classList.add("CJKVisited");
                addTested(all[i]);//it might cause some childs to be "unfixable", e.g., some elements on newsmth.org.
                continue;
            }
            child = all[i].firstChild;
            while (child) {
                var realSibling=child.nextSibling;
                if (child.nodeType == 3 && (child.data.match(/[“”‘’\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF]/))) {
                    all[i].classList.add("CJK2Fix");
                    if (!inTheClassOf(all[i],enoughSpacedList)) {
                        all[i].classList.add("PunctSpace2Fix");
                    }
                    if (!(all[i].parentNode.nodeName.match(SkippedTags))) {
                        all[i].parentNode.classList.add("CJK2Fix");
                        if (!inTheClassOf(all[i].parentNode,enoughSpacedList) && !inTheClassOf(all[i],enoughSpacedList)) {
                            all[i].parentNode.classList.add("PunctSpace2Fix");
                        }
                    }
                    break;
                }
                child=realSibling;
            }
        }
    }
    //return true;
    //Do not try to fixpuncts if it is an English site. Just trying to save time.
    labelCJK();
    if ((document.getElementsByClassName('CJK2Fix')).length < 1) {
        FixPunct=false;
    }
    if (debug_verbose===true) {console.log('FixCJK!: Labling took '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds.');}
    ///===FixFonts, Rounds 1-3===///
    FixAllFonts();
    ///===Round 4, FixPunct===///
    if (debug_verbose===true) {console.log('FixCJK!: Labling and Fixing fonts took '+((t_stop-t_start)/1000).toFixed(3)+' seconds.');}
    if ((t_stop-t_start)*2 > timeOut || max > maxNumElements ) {
        console.log('FixCJK!: Too slow or too many elements.');
        FixPunct=false;
    }
    if (FixPunct===false) {
        if (debug_verbose===true) {console.log('FixCJK!: Skipping fixing punctuations...');}
    }
    var returnNow=true;
    var returnLater=false; //Do the actual fixing.
    var MaxNumLoops=1;
    if (document.URL.match(/zhihuxcom|sinaxcom/)) {
        useLoop=true;
    }
    if (useDelayedFix===true) {
        var DelayedTimer=200;
        window.setTimeout(FunFixPunct(useLoop,MaxNumLoops,returnLater),DelayedTimer);
    }
    else {
        window.setTimeout(function () {
            labelPreCode();
            labelEnoughSpacedList();
            if (useWrap===true) wrapCJK();
            FunFixPunct(useLoop,MaxNumLoops,returnLater);
        },10);
    }
    ///===End of Solving the picture problem===///
    if (debug_verbose===true) {console.log('FixCJK!: Fixing punctuations took '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds.');}
    ///===Add onClick listener before exiting===///
    var NumClicks=0;
    var t_last=performance.now();
    var t_interval=1000; //The interval between two checks.
    var NumAllCJKs=(document.getElementsByClassName('CJK2Fix')).length;
    var NumPureEng=0;
    var LastURL=document.URL;
    var LastMod=document.lastModified;
    var ItvScl=1.0;
    if (NumAllCJKs*1.0/NumAllDOMs*100 < 1.0) {
        NumPureEng++;
    }
    //document.onClick will cause problems on some webpages on Firefox.
    var downtime=performance.now();
    var downX=0;
    var downY=0;
    document.body.addEventListener("mousedown",function (e){downtime=performance.now();downX=e.clientX;downY=e.clientY;},false);
    document.body.addEventListener("mouseup",function (e){
        if (e.button>0 ) {
            //do nothing if right button clicked.
            return true;
        }
        else if (((performance.now()-downtime) < 300) && (Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY)) ===0 ) {
            //ReFix after other things are done.
            setTimeout(ReFixCJK,5,e);
        }
    },false);
    var fireReFix=false;
    window.addEventListener("scroll",function (e){
        fireReFix=false; //Prevent from firing ReFixCJK() while scrolling.
        setTimeout(function() {fireReFix=true;},t_interval/2); //Permit ReFixCJK after sometime of last scrolling.
        setTimeout(function() {
            if (fireReFix===true) {
                ReFixCJKFontsOnly();
            }
        },t_interval);
    },false);
    document.body.addEventListener("dblclick",function() {
        addSpaces();
        //Prevent ReFixing for a certain time;
    },false);
    ///===Time to exit the main function===///
    var t_fullstop=performance.now();
    if (processedAll===true) {
        console.log('FixCJK!: NORMAL TERMINATION: '+((t_fullstop-t_start)/1000).toFixed(3)+' seconds is the overall execution time. No skipped step(s).');
    }
    else {
        console.log('FixCJK!: EXECUTION ABORTED: '+((t_fullstop-t_start)/1000).toFixed(3)+' seconds is the overall execution time. Some step(s) were skipped due to performance issues.');
    }
    ////////////////////======== Main Function Ends Here ==============/////////////////////////////
    //===The actual listening functions===//
    function labelPreCode() {
        var bannedTagList=preCodeTags.split(',');
        for (var itag=0;itag<bannedTagList.length;itag++) {
            var all2Ban=document.getElementsByTagName(bannedTagList[itag]);
            for (var iele=0;iele<all2Ban.length;iele++) {
                banHelper(all2Ban[iele]);
            }
        }
    }
    function labelEnoughSpacedList() {
        var bannedClassList=enoughSpacedList.split(',');
        for (var i=0;i<bannedClassList.length;i++) {
            var all2Ban=document.getElementsByClassName(bannedClassList[i]);
            for (var ie=0;ie<all2Ban.length;ie++)
                banHelper(all2Ban[ie]);
        }
    }
    function banHelper(node) {
        var child=node.firstChild;
        while (child) {
            if ( child.nodeType===1 && !(child instanceof SVGElement) ) {
                banHelper(child);
            }
            child=child.nextSibling;
        }
        node.classList.add("preCode");
    }
    function addSpaces() {
        var t_spaces=performance.now();
        if (debug_spaces===true) console.log('FixCJK!: Adding spaces...');
        addSpacesHelper(document.getElementsByClassName("PunctSpace2Fix"));
        function getAfter(child) {
            var toReturn='';
            var t_start=performance.now();
            while (child.textContent === child.parentNode.textContent && !child.parentNode.nodeName.match(upEnoughTags)) {
                child=child.parentNode;
            }
            child=child.nextSibling;
            while (child && (performance.now()-t_start)<2 ) {
                if (child.nodeType==3) {
                    toReturn = toReturn + child.data;
                }
                else if (child.nodeType===1) {
                    toReturn = toReturn + child.textContent;
                }
                if (toReturn.match(/[\w\u3400-\u9FBF]/)) {
                    break;
                }
                child=child.nextSibling;
            }
            return (toReturn.replace(/</,'&lt;')).replace(/>/,'&gt;');
        }
        function getBefore(child) {
            var toReturn='';
            var t_start=performance.now();
            while (child.textContent === child.parentNode.textContent && !child.parentNode.nodeName.match(upEnoughTags)) {
                child=child.parentNode;
            }
            child=child.previousSibling;
            while (child && (performance.now()-t_start)<2 ) {
                if (child.nodeType==3) {
                    toReturn = child.data + toReturn;
                }
                else if (child.nodeType===1) {
                    toReturn = child.textContent + toReturn;
                }
                if (toReturn.match(/[\w\u3400-\u9FBF]/)) {
                    break;
                }
                child=child.previousSibling;
            }
            return (toReturn.replace(/</,'&lt;')).replace(/>/,'&gt;');
        }
        function addSpacesHelper(allE) {
            for (var is=0;is<allE.length;is++) {
                if (!(allE[is].nodeName.match(/FONT/)) ) {
                    continue;
                }
                if (allE[is].classList.contains("wrappedCJK2Fix") ) {
                    if ( !(allE[is].classList.contains("preCode")) ) {
                        var tmp_str=allE[is].innerHTML;
                        if (tmp_str.match(/^[\s\u0020\u00A0\u200B-\u200E]{0,5}[\u3400-\u9FBF]/)) {
                            tmp_str=getBefore(allE[is])+'\uF203CJK\uF203'+tmp_str;
                        }
                        if (tmp_str.match(/[\u3400-\u9FBF][\s\u200B-\u200E\2060]{0,2}$/)) {
                            tmp_str=tmp_str+'\uF204CJK\uF204'+getAfter(allE[is]);
                        }
                        //protect the Latins in tags, no need in 1.0+ b/c no “”’‘ in CJK <span> tags.
                        //en:zh; //why didn't I use "non-CJK" list for Latin?
                        var re_enzh=/([\u0021\u0023-\u0026\u0029\u002A-\u003B\u003D\u003F-\u005A\u005E-\u007E\u0391-\u03FF\u2600-\u26FF])([\uF201-\uF204]CJK[\uF201-\uF204])?(?:[\u0020\u00A0\u200B-\u200E\u2060]|&nbsp;){0,5}(\uF203CJK\uF203)?(?:[\u0020\u00A0\u200B-\u200E\u2060]|&nbsp;){0,5}([\uF201-\uF204]CJK[\uF201-\uF204])?([\u3400-\u9FBF])/img;
                        var space2BeAdded='<span class="CJKVisited MarksFixedE135 \uE699 FontsFixedE137" style="display:inline;padding-left:0px;padding-right:0px;float:none;font-family:Arial,Helvetica,sans-serif;font-size:80%;">\u0020</span>';
                        if (useSFTags===false) {space2BeAdded='\u2009';} //\u2009 for thin space and \u200A for "hair space".
                        var enzh_withSpace='$1$2$3$4'+space2BeAdded+'$5';
                        tmp_str=tmp_str.replace(re_enzh,enzh_withSpace);
                        //Special treatment of ’” because of lacking signature in the closing tag (</span>)
                        /////first after tags
                        re_enzh=/((?:<[^\uE985\uE211><]*>)+[\u201D\u2019])(?:[\u0020\u00A0\u200B-\u200E]|&nbsp;){0,5}([\uF201-\uF204]CJK[\uF201-\uF204])?(<[^\uE985\uE211><]*>){0,5}(?:[\u0020\u00A0\u200B-\u200E]|&nbsp;){0,5}([\uF201-\uF204]CJK[\uF201-\uF204])?([\u3400-\u9FBF])/img;
                        tmp_str=tmp_str.replace(re_enzh,enzh_withSpace);
                        /////then without tags
                        re_enzh=/([^>][\u201D\u2019])(?:[\u0020\u00A0\u200B-\u200E]|&nbsp;){0,5}([\uF201-\uF204]CJK[\uF201-\uF204])?(<[^\uE985\uE211><]*>){0,5}(?:[\u0020\u00A0\u200B-\u200E]|&nbsp;){0,5}([\uF201-\uF204]CJK[\uF201-\uF204])?([\u3400-\u9FBF])/img;
                        tmp_str=tmp_str.replace(re_enzh,enzh_withSpace);
                        //now zh:en
                        var re_zhen=/([\u3400-\u9FBF])(?:[\u0020\u00A0\u200B-\u200E\u2060]|&nbsp;){0,5}([\uF201-\uF204]CJK[\uF201-\uF204])?(?:[\u0020\u00A0\u200B-\u200E\u2060]|&nbsp;){0,5}([\uF201-\uF204]CJK[\uF201-\uF204])?([‘“\u0021\u0023-\u0026\u0028\u002A-\u003B\u003D\u003F-\u005A\u005E-\u007E\u0391-\u03FF\u2600-\u26FF])/img;
                        var zhen_withSpace='$1'+space2BeAdded+'$2$3$4';
                        tmp_str=tmp_str.replace(re_zhen,zhen_withSpace);
                        //now en["']zh (TODO in 0.15?)
                        //now zh['"]en (TODO in 0.15?)
                        tmp_str=tmp_str.replace(/\uED20/mg,'');
                        tmp_str=tmp_str.replace(/^[^\u0000]*\uF203CJK\uF203([^\u0000]*)$/,'$1'); // '.' does not match \n in whatever mode.
                        tmp_str=tmp_str.replace(/^([^\u0000]*)\uF204CJK\uF204[^\u0000]*$/,'$1');
                        allE[is].innerHTML=tmp_str;
                    }
                    else {
                        if (debug_spaces===true) {console.log("Skipping banned tags:"+allE[is].tagName);}
                    }
                }
            }
        }
        if (useRemoveSpacesForSimSun===true) {
            window.setTimeout(removeSpacesForSimSun,10);
        }
        console.log("FixCJK: Adding spaces took "+((performance.now()-t_spaces)/1000).toFixed(3)+" seconds.");
    }
    function removeSpacesForSimSun() { //Need more work.
        var allS=document.getElementsByClassName("\uE699");
        var font_str='';
        for (var i=0;i<allS.length;i++) {
            font_str=((dequote(window.getComputedStyle(allS[i].parentNode, null).getPropertyValue('font-family'))).split(','))[1];
            if (font_str.match(re_simsun)) {
                allS[i].innerHTML='';
            }
            else if (font_str.match(/RealCJKBold.易/))  {
                allS[i].parentNode.classList.add("checkSpacedQM");
            }
        }
        allS=document.getElementsByClassName("checkSpacedQM");
        for (i=0;i<allS.length;i++){
            var toRemoved=/(<span[^><]*\uE699[^><]*>\u0020<\/span>)((?:<[^><\uE985\uE211]*>)*[\u2018\u201C])/g;
            if (allS[i].innerHTML.match(toRemoved)) {
                allS[i].innerHTML=allS[i].innerHTML.replace(toRemoved,'$2');
            }
            //No closing tag: En"Zh
            toRemoved=/([\u2019\u201D])<span[^><]*\uE699[^><]*>\u0020<\/span>/g;
            if (allS[i].innerHTML.match(toRemoved)) {
                allS[i].innerHTML=allS[i].innerHTML.replace(toRemoved,'$1');
            }
            //With closing tag: En"Zh
            toRemoved=/((?:^|[^>]|<[^><\uE211\uE985]*>)[\u2019\u201D](?:<[^><\uE211\uE985]*>)+)(<span[^><]*\uE699[^><]*>\u0020<\/span>)/mg;
            if (allS[i].innerHTML.match(toRemoved)) {
                allS[i].innerHTML=allS[i].innerHTML.replace(toRemoved,'$1');
            }
        }
    }
    function ReFixCJKFontsOnly () {
        if (refixingFonts===true) {
            if (debug_wrap===true) {console.log("Refixing, skipping this refix...");}
            window.setTimeout(function () {refixingFonts=false;},t_interval*3);
            return false;
        }
        refixingFonts=true;
        var bannedTagsInReFix=/^(A|BUTTON|TEXTAREA|AUDIO|VIDEO|SOURCE|FORM|INPUT|select|option|label|fieldset|datalist|keygen|output|canvas|nav|svg|img|figure|map|area|track|menu|menuitem)$/i;
        if (debug_verbose===true) {console.log(e.target.nodeName);}
        t_start=performance.now();
        if ( (t_start-t_last)*ItvScl > t_interval ) {
            FixRegular = true; //Also fix regular fonts. You need to keep this true if you want to use "LatinInSimSun" in Latin/CJK mixed context.
            FixMore = false; //Appendent CJK fonts to all elements. No side effects found so far.
            FixPunct = false; //If Latin punctions in CJK paragraph need to be fixed. Usually one needs full-width punctions in CJK context. Turn it off if the script runs too slow or HTML strings are adding to your editing area.
            ifRound1 = true;
            ifRound2 = true;
            ifRound3 = false;
            maxlength = 1100200; //maximum length of the page HTML to check for CJK punctuations.
            maxNumElements = 8000; // maximum number of elements to process.
            CJKOnlyThreshold = 2000; // Only CJK if the number of elements reaches this threshold.
            labelCJK();
            FixAllFonts();
            console.log('FixCJK!: Fast ReFixing took '+((performance.now()-t_start)/1000).toFixed(3)+' seconds.');
        }
        else {
            console.log('FixCJK!: No need to rush. Just wait for '+(t_interval/1000/ItvScl).toFixed(1)+' seconds before clicking again.');
        }
        t_last=performance.now();
        refixingFonts=false;
    }
    function ReFixCJK (e) {
        if (refixing===true) {
            if (debug_wrap===true) {console.log("Refixing, skipping this refix...");}
            window.setTimeout(function () {refixing=false;},t_interval);
            return false;
        }
        refixing=true;
        var bannedTagsInReFix=/^(A|BUTTON|TEXTAREA|AUDIO|VIDEO|SOURCE|FORM|INPUT|select|option|label|fieldset|datalist|keygen|output|canvas|nav|svg|img|figure|map|area|track|menu|menuitem)$/i;
        if (debug_verbose===true) {console.log(e.target.nodeName);}
        t_start=performance.now();
        if (document.URL!==LastURL) {
            NumPureEng = 0;
            LastURL=document.URL;
        }
        var clickedNode=e.target;
        while (clickedNode && clickedNode.nodeName!=="BODY") {
            if (clickedNode.nodeName.match(bannedTagsInReFix)) {
                console.log("FixCJK!: Not a valid click on DOM element \u201C"+clickedNode.nodeName+"."+clickedNode.className+"\u201D");
                refixing=false;
                return false;
            }
            if (debug_verbose===true) {console.log("Clicked: "+clickedNode.nodeName);}
            clickedNode=clickedNode.parentNode;
        }
        if ((document.lastModified===LastMod) && (NumClicks >2)) {
            if (debug_verbose===true) {console.log('FixCJK!: Document modified at '+document.lastModified+', no change?');}
        }
        else {
            if (debug_verbose===true) {console.log('FixCJK!: Document modified at '+document.lastModified);}
        }
        //NumPureEng method is still usefull because document.lastModified method is only partially reliable.
        if (NumPureEng >= 2) {
            console.log('Probably pure English/Latin site, re-checking skipped.');
            refixing=false;
            return true;
        }
        if (debug_verbose===true) {alert('FixCJK!: '+NumClicks.toString());}
        //First remove the "CJK2Fix" attibute for those already processed.
        var AllCJKFixed=document.getElementsByClassName("FontsFixedE137");
        for (i=0;i<AllCJKFixed.length;i++) {
            if (AllCJKFixed[i].classList.contains("wrappedCJK2Fix")) {
                continue;
            }
            if (debug_verbose===true) {console.log(AllCJKFixed[i].className);}
            if (AllCJKFixed[i].classList.contains("MarksFixedE135")) {
                AllCJKFixed[i].classList.remove("CJK2Fix");
            }
        }
        if ((NumClicks < 1) || (t_start-t_last)*ItvScl > t_interval ) {
            FixRegular = true; //Also fix regular fonts. You need to keep this true if you want to use "LatinInSimSun" in Latin/CJK mixed context.
            FixMore = true; //Appendent CJK fonts to all elements. No side effects found so far.
            FixPunct = true; //If Latin punctions in CJK paragraph need to be fixed. Usually one needs full-width punctions in CJK context. Turn it off if the script runs too slow or HTML strings are adding to your editing area.
            maxlength = 1100200; //maximum length of the page HTML to check for CJK punctuations.
            maxNumElements = 8000; // maximum number of elements to process.
            CJKOnlyThreshold = 2000; // Only CJK if the number of elements reaches this threshold.
            invForLimit=6; //the time limit factor (actual limit is timeOut/invForLimit) for the "for loop" in Round 2 & 3.
            processedAll=true;
            ifRound1=true;
            ifRound2=true;
            ifRound3=false;
            //FixCJK();
            var ReFixAll=document.getElementsByTagName('*');
            var NumFixed=0;
            var NumReFix=0;
            labelCJK();
            FixAllFonts();
            if (debug_verbose===true) {console.log('FixCJK!: '+NumFixed.toString()+' elements has been fixed.');}
            if (debug_verbose===true) {console.log('FixCJK!: '+NumReFix.toString()+' elements to Re-Fix.');}
            labelPreCode();
            labelEnoughSpacedList();
            if (useWrap===true) wrapCJK();
            FunFixPunct(useLoop,2,returnLater);
            console.log('FixCJK!: ReFixing took '+((performance.now()-t_start)/1000).toFixed(3)+' seconds.');
            NumAllCJKs=(document.getElementsByClassName('MarksFixedE135')).length;
            if (NumAllCJKs*1.0/NumAllDOMs*100 < 1.0) {
                NumPureEng++;
            }
        }
        else {
            console.log('FixCJK!: No need to rush. Just wait for '+(t_interval/1000/ItvScl).toFixed(1)+' seconds before clicking again.');
        }
        NumClicks++;
        LastMod=document.lastModified;
        t_last=performance.now();
        refixing=false;
    }
    ///===various aux functions===///
    function wrapCJK() {
        var wrap_start=performance.now();
        var allCJK=document.getElementsByClassName("CJK2Fix");
        for (var i=0;i<allCJK.length;i++) {
            if (allCJK[i].classList.contains("wrappedCJK2Fix")|| allCJK[i].classList.contains("\uE211") || allCJK[i].classList.contains("\uE985") ||allCJK[i].classList.contains("preCode")) {
                continue;
            }
            else if (allCJK[i].nodeName.match(SkippedTagsForMarks)) {
                continue;
            }
            var child=allCJK[i].firstChild;
            while(child) {
                var realSibling=child.nextSibling;
                if (child.nodeType===3  && (child.data.match(/[“”‘’\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF]/)) ) {
                    wrapCJKHelper(child);
                }
                child=realSibling;
            }
        }
        if (debug_wrap===true) console.log("Wrapping took "+((performance.now()-wrap_start)/1000).toFixed(3)+" seconds.");
        function wrapCJKHelper(child) {
            var iNode=document.createElement("font");
            var iText=document.createTextNode(child.data);
            iNode.appendChild(iText);
            iNode.classList.add("wrappedCJK2Fix");
            iNode.classList.add("CJKVisited");
            iNode.classList.add("PunctSpace2Fix");
            iNode.classList.add("CJK2Fix");
            iNode.classList.add("Safe2FixCJK\uE000");
            child.parentNode.insertBefore(iNode,child.nextSibling);
            child.data=""; //or "\u200B?"
        }
    }
    function inTheClassOf(node,cList) {
        var classes=cList.split(',');
        for (var i=0;i<classes.length;i++) {
            if (node.classList.contains(classes[i])) {
                return true;
            }
        }
        return false;
    }
    function check_fonts(font_var, fvname) {
        var fl = font_var.split(',');
        for (i = 0; i < fl.length; i++) {
            if (!(fl[i].match(/^[^" ][^"]+[^" ]$|^"[^ ][^"]+[^ ]"$/))) {
                alert('Check your font definition: ' + fl[i] + ' in ' + fvname);
                return false;
            }
        }
        return true;
    }
    function list_has(font_str, family) {
        /// Fucntion to check matches
        var allfonts = font_str.split(',');
        for (var j = 0, maxl = allfonts.length; j < maxl; j++) {
            if (allfonts[j].match(family)) {
                return j;
            }
        }
        return false;
    }
    function replace_font(font_str, family, qBold) {
        var allfonts = font_str.split(',');
        var j = 0;
        var maxl = allfonts.length;
        for (j = 0; j < maxl; j++) {
            if (allfonts[j].match(family)) {
                allfonts[j] = qBold;
            }
        }
        var toReturn = allfonts[0];
        for (j = 1; j < maxl; j++) {
            toReturn = toReturn + ',' + allfonts[j];
        }
        return toReturn;
    }
    function has_genfam(font_str) {
        /// Test if font_str include general families.
        if (list_has(font_str, re_sans0)) {
            return true;
        }
        else if (list_has(font_str, re_serif)) {
            return true;
        }
        else if (list_has(font_str, re_mono0)) {
            return true;
        }
        return false;
    }
    function dequote(font_str) {
        /// Function to dequote non-standard font lists.
        var strl=font_str.split(','); //font list;
        for (var k=0;k < strl.length; k++) {
            while (strl[k].charAt(0).match(/["' ]/)) {
                strl[k]=strl[k].slice(1);
            }
            while (strl[k].charAt(strl[k].length-1).match(/["' ]/)) {
                strl[k]=strl[k].slice(0,-1);
            }
        }
        var dequoted=strl[0];
        for (k=1;k<strl.length;k++) {
            dequoted=dequoted+','+strl[k];
        }
        return dequoted;
    }
    function FirstFontOnly(font_str) {
        return ((dequote(font_str)).split(','))[0];
    }
    function AddLocal(font_str) {
        font_str=(dequote(font_str)).split(',');
        var localed='local("'+font_str[0]+'"), local("'+font_str[0]+' Regular")';
        for (var l=1;l<font_str.length;l++) {
            localed=localed+',\n'+'local("'+font_str[l]+'"),local("'+font_str[l]+' Regular")';
        }
        return localed;
    }
    /// ======================== FixAllFonts, 3 Rounds ==============================///
    function FixAllFonts () {
        var func_start=performance.now();
        if (debug_verbose===true) {
            console.log("Round 1: "+ifRound1.toString());
            console.log("Round 2: "+ifRound2.toString());
            console.log("Round 3: "+ifRound3.toString());
        }
        SkippedTags=SkippedTagsForFonts;
        /// ===== First round: Replace all bold fonts to CJKBold ===== ///
        t_stop=performance.now();
        //First fix all SimSun parts in Round 1&2.
        var allSuns=document.getElementsByClassName("SimSun2Fix");
        for (var isun=0;isun< allSuns.length;isun++) {
            if (allSuns[isun].classList.contains("FontsFixedE137")) {
                continue;
            }
            font_str = dequote(window.getComputedStyle(allSuns[isun], null).getPropertyValue('font-family'));
            if (font_str.match(re_simsun) &&  !(font_str.match(sig_sim))  ) {
                allSuns[isun].style.fontFamily = font_str.replace(re_simsun,qSimSun);
            }
        }
        allSuns=document.getElementsByClassName("LargeSimSun2Fix");
        for (isun=0;isun< allSuns.length;isun++) {
            if (allSuns[isun].classList.contains("FontsFixedE137")) {
                continue;
            }
            font_str = dequote(window.getComputedStyle(allSuns[isun], null).getPropertyValue('font-family'));
            if (font_str.match(re_simsun) &&  !(font_str.match(sig_sim))  ) {
                allSuns[isun].style.fontFamily = font_str.replace(re_simsun,qLargeSimSun);
            }
        }
        all = document.getElementsByClassName('CJK2Fix');
        if (ifRound1===true) {
            for (i = 0; i < all.length; i++) {
                if (i % 500===0) { //Check every 500 elements.
                    if ((performance.now()-t_stop)*invForLimit > timeOut) {
                        ifRound1=false;
                        ifRound2=false;
                        ifRound3=false;
                        FixPunct=false;
                        processedAll=false;
                        console.log('FixCJK!: Round 1 itself has been running for '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds. Too slow to continue.');
                        break;
                    }
                    else {
                        if (debug_verbose===true) {console.log('FixCJK!: Round 1 itself has been running for '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds.');}
                    }
                }
                if (all[i].classList.contains("FontsFixedE137")) {
                    continue;
                }
                child = all[i].firstChild;
                if_replace = false;
                //Only change if current node (not child node) contains CJK characters.
                font_str = dequote(window.getComputedStyle(all[i], null).getPropertyValue('font-family'));
                fweight = window.getComputedStyle(all[i], null).getPropertyValue('font-weight');
                while (child) {
                    var realSibling=child.nextSibling;
                    if (child.nodeType == 3 && (child.data.match(/[“”‘’\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF]/)) && (fweight == 'bold' || fweight > 500) && (!(font_str.match(sig_bold)))) {
                        //Test if contains SimSun
                        if (debug_01===true) {all[i].style.color="Blue";} //Bold-->Blue;
                        if (font_str.match(re_simsun)) {
                            //all[i].style.color="Sienna"; //SimSun --> Sienna
                            all[i].style.fontFamily = genPunct+','+font_str.replace(re_simsun, qBold);
                            if (!(has_genfam(all[i].style.fontFamily))) {
                                all[i].style.fontFamily = genPunct+','+all[i].style.fontFamily + ',' + 'sans-serif';
                                all[i].classList.add("FontsFixedE137");
                            }
                        }        //Test if contains Sans
                        else if (list_has(font_str, re_sans0) !== false) {
                            //all[i].style.color="Salmon";
                            all[i].style.fontFamily = genPunct+','+ replace_font(font_str, re_sans0, LatinSans+','+qBold) + ',sans-serif';
                            all[i].classList.add("FontsFixedE137");
                        }        //Test if contains serif
                        else if (list_has(font_str, re_serif) !== false) {
                            //all[i].style.color="SeaGreen";
                            all[i].style.fontFamily = genPunct+','+ replace_font(font_str, re_serif, LatinSerif + ',' +qBold) + ',serif';
                            all[i].classList.add("FontsFixedE137");
                        }        //Test if contains monospace
                        else if (list_has(font_str, re_mono0) !== false) {
                            //all[i].style.color="Maroon";
                            all[i].style.fontFamily = genPunct+','+ replace_font(font_str, re_mono0, LatinMono + ',' +qBold) + ',monospace';
                            all[i].classList.add("FontsFixedE137");
                        }        //Just append the fonts to the font preference list.
                        else {
                            //all[i].style.color="Fuchsia"; //qBold+"false-safe" sans-serif;
                            all[i].style.fontFamily = genPunct+','+font_str + ',' + LatinSans + ',' + qBold + ',' + '  sans-serif';
                            all[i].classList.add("FontsFixedE137");
                            //console.log(all[i].style.fontFamily);
                        }
                    }
                    child = realSibling;
                }
            }
        }
        if (FixRegular === false) {
            return false;
        }
        /// ===== Second Round: Deal with regular weight. ===== ///
        var tmp_idx=0;
        max = all.length;
        if ((performance.now()-t_stop)*4 > timeOut) {
            ifRound2=false;
            ifRound3=false;
            FixPunct=false;
            processedAll=false;
            console.log('FixCJK!: Round 1 has been running for '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds. Skipping following steps.');
        }
        t_stop=performance.now();
        if (ifRound2===true) {
            //Now fix the rest.
            for (i = 0; i < all.length; i++) {
                if (i % 500===0) { //Check every 500 elements.
                    if ((performance.now()-t_stop)*invForLimit > timeOut) {
                        ifRound2=false;
                        ifRound3=false;
                        FixPunct=false;
                        processedAll=false;
                        console.log('FixCJK!: Round 2 itself has been running for '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds. Too slow to continue.');
                        break;
                    }
                    else {
                        if (debug_verbose===true) {console.log('FixCJK!: Round 2 itself has been running for '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds.');}
                    }
                }
                if (all[i].classList.contains("FontsFixedE137") ) {
                    continue;
                }
                font_str = dequote(window.getComputedStyle(all[i], null).getPropertyValue('font-family'));
                fweight = window.getComputedStyle(all[i], null).getPropertyValue('font-weight');
                if (font_str.match(sig_hei) || font_str.match(sig_song) ||font_str.match(sig_bold) || font_str.match(sig_mono) || font_str.match(sig_default)) {
                    all[i].classList.add("FontsFixedE137");
                    continue;
                }
                else {
                    if (debug_02===true) {all[i].style.color='Teal';} //Teal for true;
                    if (debug_02===true) {if (all[i].innerHTML.match(re_to_check)) {console.log('\\\\\\\\\\\\afterall:'+i.toString()+'::'+all[i].style.fontFamily+'\n-->if_replace:'+if_replace);}}
                    //Test if contains Sans
                    if (list_has(font_str, re_sans0) !== false) {
                        //all[i].style.color="Salmon";
                        all[i].style.fontFamily = genPunct+','+replace_font(font_str, re_sans0, qsans);
                        all[i].classList.add("FontsFixedE137");
                    }      //Test if contains serif
                    else if (list_has(font_str, re_serif) !== false) {
                        //all[i].style.color="SeaGreen";
                        all[i].style.fontFamily = genPunct+','+replace_font(font_str, re_serif, qserif);
                        all[i].classList.add("FontsFixedE137");
                    }      //Test if contains monospace
                    else if (list_has(font_str, re_mono0) !== false) {
                        //all[i].style.color="Maroon";
                        all[i].style.fontFamily = genPunct+','+replace_font(font_str, re_mono0, qmono);
                        all[i].classList.add("FontsFixedE137");
                    }
                    else {
                        if (debug_02===true) {all[i].style.color='Fuchsia';}
                        if (font_str.match(re_simsun)) {
                            //Do nothing.
                        }
                        else {
                            all[i].style.fontFamily = genPunct+','+font_str + ',' + qCJK + ',' + 'sans-serif';
                            all[i].classList.add("FontsFixedE137");
                        }
                    }
                }
                if (FixMore === false) {
                    //Add FontsFixed if Round 3 is skipped intentially.
                    //all[i].classList.add("FontsFixedE137");
                }
            }
        }
        if (debug_verbose===true) {console.log('FixCJK!: Round 2 took '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds.');}
        t_stop=performance.now();
        if (debug_02===true) console.log('Just before Round 3:'+tmp_idx.toString()+'::'+all[tmp_idx].innerHTML);
        if (debug_02===true) console.log('Just before Round 3:'+tmp_idx.toString()+'::'+dequote(window.getComputedStyle(all[tmp_idx], null).getPropertyValue('font-family')));
        /// ===== The Third round (Round 3): Add CJKdefault to all elements ===== ///
        if (FixMore === false) {
            t_stop=performance.now();
            if (debug_verbose===true) {console.log('FixCJK!: FixMore/Round 3 is intentionally skipped.');}
            return false;
        }
        all = document.getElementsByTagName('*');
        max = all.length;
        if (max > maxNumElements) {
            ifRound3=false;
            FixPunct=false;
            processedAll=false;
            console.log('FixCJK!: '+max.toString()+' elements, too many. Skip Round 3 and punctuation fixing. Exiting now...');
        }
        else if (max > CJKOnlyThreshold) {
            ifRound3=true;
            FixPunct=true;
            processedAll=true;
            all = document.getElementsByTagName('CJK2Fix');
            console.log('FixCJK!: '+max.toString()+' elements, too many. Only CJK elements will be processed in Round 3.');
        }
        else {
            if (debug_verbose===true) {console.log('FixCJK!: All elements will be processed in Round 3.');}
        }
        if (ifRound3===true) {
            for (i = 0; i < all.length; i++) {
                //all[i].style.color="SeaGreen";
                if (i % 500===0) { //Check every 500 elements.
                    if ((performance.now()-t_stop)*invForLimit > timeOut) {
                        ifRound3=false;
                        FixPunct=false;
                        processedAll=false;
                        console.log('FixCJK!: Round 3 itself has been running for '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds. '+i.toFixed(0)+' elements have been fixed, but too slow to continue. Stopped at:');
                        console.log(all[i]);
                        break;
                    }
                    else {
                        if (debug_verbose===true) {console.log('FixCJK!: Round 3 itself has been running for '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds. ');}
                    }
                }
                if (all[i].nodeName.match(SkippedTags) || (all[i] instanceof SVGElement) ) {
                    continue;
                }
                else if (all[i].classList.contains("FontsFixedE137")) {
                    continue;
                }
                font_str = dequote(window.getComputedStyle(all[i], null).getPropertyValue('font-family'));
                if (font_str.split(',').length >= rspLength) {
                    //continue if all[i] contains a list of fonts.
                    all[i].classList.add("FontsFixedE137");
                    continue;
                }
                if (!(font_str.match(sig_song) || font_str.match(sig_hei) || font_str.match(sig_bold) || font_str.match(sig_default) || font_str.match(/\uE137/))) {
                    if (list_has(font_str, re_sans0) !== false) {
                        //all[i].style.color="Salmon";
                        all[i].style.fontFamily = genPunct+','+replace_font(font_str, re_sans0, qsans);
                    }      //Test if contains serif
                    else if (list_has(font_str, re_serif) !== false) {
                        //all[i].style.color="SeaGreen";
                        all[i].style.fontFamily = genPunct+','+replace_font(font_str, re_serif, qserif);
                    }      //Test if contains monospace
                    else if (list_has(font_str, re_mono0) !== false) {
                        //all[i].style.color="Maroon";
                        all[i].style.fontFamily = genPunct+','+replace_font(font_str, re_mono0, qmono);
                    }
                    else {
                        //SimSun should be taken care of throught the "SimSun2Fix" class.
                        if (debug_03 === true) { all[i].style.color='Olive';}
                        all[i].style.fontFamily = genPunct+','+font_str + ',' + qCJK + ',' + 'sans-serif';
                    }
                }
                else {
                    //all[i].style.color="Silver"; //Signed-->Silver
                }
                all[i].classList.add("FontsFixedE137");
            }
        }
        if (debug_verbose===true) {console.log('FixCJK!: Round 3 took '+((performance.now()-t_stop)/1000).toFixed(3)+' seconds.');}
        t_stop=performance.now();
        if (debug_wrap===true) console.log("Fixing Fonts took "+((performance.now()-func_start)/1000).toFixed(3)+" seconds.");
    }
    ///===The Actual Round 4===///
    function FunFixPunct(useLoop,MaxNumLoops,returnNow) {
        SkippedTags=SkippedTagsForMarks;
        var recursion_start=0;
        var func_start=performance.now();
        //Use Recursion instead of loop, should be put in the MaxNumLoops in production code.
        if (returnNow===true) {
            return true;
        }
        var useRecursion=true;
        if (useLoop===true) {console.log('Must use "useRecursion=true"');}
        if (useRecursion===true) {
            if (debug_verbose===true) {console.log('Using Recursion');}
            var allrecur=document.getElementsByClassName("PunctSpace2Fix");
            for (var ir=0; ir<allrecur.length; ir++) {
                //Seems no need to add !(allrecur[ir].parentNode.classList.contains("CJK2Fix")). It might be faster to fix the deepest element first through looping.
                recursion_start=performance.now();
                if (allrecur[ir].nodeName.match(/FONT/)) {
                    FixPunctRecursion(allrecur[ir]);
                }
                if ( (performance.now()-t_start) > timeOut ) {
                    processedAll=false;
                    console.log("FixCJK!: Time out. Last fixing took "+((performance.now()-recursion_start)/1000).toFixed(3)+" seconds.");
                    console.log("FIXME:"+allrecur[ir].nodeName+"."+allrecur[ir].className);
                    break;
                }
            }
        }
        if (debug_wrap===true) console.log("Fixing Punct took "+((performance.now()-func_start)/1000).toFixed(3)+" seconds.");
    }
    /////=====The Recursive Implementation=====/////
    function FixPunctRecursion(node) {
        if (node.classList.contains("MarksFixedE135")) {
            return true;
        }
        else if ( !(node.tagName.match(/FONT/)) ) {
            return false;
        }
        if (debug_re_to_check===true && (node.innerHTML.match(re_to_check))) {console.log("Checking node: "+node.nodeName+"."+node.className+"@"+node.parentNode.nodeName+":: "+node.innerHTML.slice(0,216));}
        var tabooedTags=SkippedTagsForMarks;
        var child=node.firstChild;
        var currHTML="";
        var allSubSafe=true;
        var node2fix=true;
        if ((node.nodeName.match(tabooedTags)) || inTheClassOf(node,enoughSpacedList)) {
            //Although BODY is tabooed, this is OK because a loop is outside this recursive implementation.
            node.classList.remove("Safe2FixCJK\uE000");
            node.classList.remove("PunctSpace2Fix");
            node.classList.add("MarksFixedE135");
            return false;
        }
        //Add lang attibute. Firefox cannot detect lang=zh automatically and it will treat CJK characters as letters if no lang=zh. For example,
        //the blank spaces will be streched but not the "character-spacing" if using align=justify.
        if (window.getComputedStyle(node.parentNode,null).getPropertyValue('text-align').match(/start/) && useJustify===true) {
            node.parentNode.style.textAlign="justify";
        }
        //node.lang="zh";
        node.parentNode.lang="zh";
        while (child) {
            if (debug_re_to_check===true && (node.innerHTML.match(re_to_check))) {console.log("Checking subnode: "+child+"@"+node.nodeName);}
            if ( child.nodeType === 3 && !(node.nodeName.match(tabooedTags)) ) {
                if (debug_re_to_check===true && (node.innerHTML.match(re_to_check))) {console.log("Found as Type 3 subnode: "+child.nodeName+"."+child.className+"@"+node.nodeName+":: "+child.data);}
                if (debug_verbose===true) {
                    console.log("Permitted to check: "+node.nodeName+"."+node.className);
                }
                if (debug_re_to_check===true && (node.innerHTML.match(re_to_check)) && node.nodeName.match(tabooedTags)) {
                    console.log("ERROR: Wrong Operation on: "+node.nodeName+"."+node.className+":: "+node.textContent);
                    console.log("ERROR: Wrong Operation because: "+child.data);
                }
            }
            if (child.nodeType===1 && !(child instanceof SVGElement))  {
                if  ((child.nodeName.match(tabooedTags) ) || inTheClassOf(child,enoughSpacedList) ) {
                    //was like this: if  (child.nodeName.match(tabooedTags) || child.classList.contains("MarksFixedE135")) {. I don't know why.
                    child.classList.remove("Safe2FixCJK\uE000");
                    child.classList.remove("CJK2Fix");
                    child.classList.add("MarksFixedE135");
                    node2fix=false;
                }
                else if (child.nodeName.match(ignoredTags)) {
                    //Simply do nothing. Such as <math> tag.
                    child.classList.add("Safe2FixCJK\uE000");
                    child.classList.add("MarksFixedE135");
                }
                else if (child.classList.contains("MarksFixedE135")) {
                    //Fixed, do nothing.
                }
                else if (child.nodeName.match(/FONT/)) {
                    FixPunctRecursion(child); //This is the recursion part. Not really recursion after 0.15.... 
                }
                else {
                    //do nothing;
                }
                //Test again after fixing child:
                if (!(child.classList.contains("Safe2FixCJK\uE000"))) {allSubSafe=false;} //\uE000 is Tux in Linux Libertine.
            }
            child=child.nextSibling;
        }
        if (allSubSafe===true && (!(node instanceof SVGElement))) {
            var orig_class=node.className;
            var CJKclasses=CJKclassList.split(',');
            for (var icl=0;icl<CJKclasses.length;icl++) {
                node.classList.remove(CJKclasses[icl]);
            }
            if (node.tagName.match(SafeTags)) {
                //note that Safe2FixCJK\uE000 means it is safe as a subelement. Safe2FixCJK\uE000 also means node.innerHTML is safe. However itself may have event listeners attached to it.
                node.className=orig_class;
                node.classList.add("Safe2FixCJK\uE000");
            }
            else if (node.classList.length===0 && node.id.length ===0 && !(node.nodeName.match(tabooedTags)) && !(inTheClassOf(node,enoughSpacedList))) {
                //It would be crazy if add listeners just by tags.
                node.className=orig_class;
                node.classList.add("Safe2FixCJK\uE000");
            }
            else {
                node.className=orig_class;
            }
        }
        //Config and Filtering Done. Fix puncts if necessary.
        if (allSubSafe===true && node2fix===true && !(node.nodeName.match(tabooedTags)) && !(inTheClassOf(node,enoughSpacedList)) && node.classList.contains("CJK2Fix") && !(node.classList.contains("MarksFixedE135"))) {
            if (debug_verbose===true) console.log("USING Recursion: "+node.nodeName+'.'+node.className);
            if (debug_verbose===true) { console.log("WARNING: Danger Operation on: "+node.nodeName+"."+node.className+":: "+node.innerHTML.slice(0,216)); }
            if (debug_re_to_check===true && (node.innerHTML.match(re_to_check))) {console.log("Checking if contain punctuations to fix");}
            if (node.innerHTML.match(/[“”‘’、，。：；！？）】〉》」』『「《〈【（]/m)) {
                if (debug_re_to_check===true && (node.innerHTML.match(re_to_check))) { console.log("WARNING: Danger Operation on: "+node.nodeName+"."+node.className);}
                if (node.classList.contains("preCode")) {
                    node.classList.remove("Safe2FixCJK\uE000"); //Do not performan fixing on "fully banned" tags.
                    node.classList.remove("PunctSpace2Fix");
                }
                else if (window.getComputedStyle(node, null).getPropertyValue("white-space").match(/pre/)){
                    node.innerHTML=FixMarksInCurrHTML(node.innerHTML,node,false);
                }
                else {
                    if (debug_re_to_check===true && (node.innerHTML.match(re_to_check))) {console.log("Now fixing --> "+node.nodeName+"."+node.className+":: "+node.innerHTML.slice(0,216));}
                    node.innerHTML=FixMarksInCurrHTML(node.innerHTML,node,true);
                }
            }
            node.classList.add("MarksFixedE135");
            return true;
        }
        else {
            node.classList.add("MarksFixedE135");
            return true;
        }
    }
    ///==Fix punct in a currHTML===///
    function FixMarksInCurrHTML(currHTML,node,delete_all_extra_spaces) {
        //“<-->\u201C, ”<-->\u201D
        //‘<-->\u2018, ’<-->\u2019
        var performSingleRightSqueeze=true;
        var changhai_style=false;
        var Squeezing=true;
        var SqueezeInd=true;
        var tmp_str='';
        var FixMarks_start=performance.now();
        if (changhai_style===true) {
            //Simply inserting blanck space, like changhai.org.
            currHTML=currHTML.replace(/([\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF]?)([“‘])([\u3400-\u9FBF\u3000-\u303F\uFF00-\uFFEF]+)/g,'$1 $2$3');
            currHTML=currHTML.replace(/([\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF])([”’])([^，, ])/g,'$1$2 $3');
            if (debug_04===true) {console.log(currHTML);}
            all[currpunc].innerHTML=currHTML;
            return true;
        }
        //currHTML=currHTML.replace(/^([、，。：；！？）】〉》」』\u201D\u2019])/mg,'\u2060$1');//Remove the hanging puncts. Seems no use at all.
        //if (currHTML.match(/^[、，。：；！？）】〉》」』\u201D\u2019]/))
        if (currHTML.match(/^[、，。：；！？）】〉》」』\u201D\u2019『「《〈【（\u201C\u2018]/)) {
            if (debug_tagSeeThrough===true) console.log("TO CHECK BEFORE: "+currHTML);
            if (debug_tagSeeThrough===true) console.log("FULL PARENT: "+node.parentNode.textContent);
            currHTML=getBefore(node)+'\uF201CJK\uF201'+currHTML;
            if (debug_tagSeeThrough===true) console.log("FULL CLOSED FORM: "+currHTML);
        }
        //if (currHTML.match(/[『「《〈【（\u201C\u2018]$/)) {
        if (currHTML.match(/[、，。：；！？）】〉》」』\u201D\u2019『「《〈【（\u201C\u2018]$/)) {
            if (debug_tagSeeThrough===true) console.log("TO CHECK AFTER: "+currHTML);
            if (debug_tagSeeThrough===true) console.log("LAST CHAR: "+currHTML+"@"+performance.now());
            //Separate currHTML with following text.
            currHTML=currHTML+'\uF202CJK\uF202'+getAfter(node);
            if (node.parentNode.id.match(/overtag/)) console.log(node.parentNode.id+'#'+currHTML);
            if (debug_tagSeeThrough===true) console.log("FULL FORM: "+currHTML+"@"+performance.now());
        }
        if (debug_tagSeeThrough===true) console.log("Continuation took "+(performance.now()-FixMarks_start).toFixed(1)+" ms.");
        if (useFeedback===true && currHTML.match(/[\uF201-\uF204]/)) {
            if (!currHTML.match(/[\uF201-\uF204]CJK[\uF201-\uF204]/) || (currHTML.match(/[\uF201-\uF204]/g)).length !== ((currHTML.match(/[\uF201-\uF204]CJK[\uF201-\uF204]/g)).length*2)) {
                alert("This page may conflict with FixCJK!. If you would like to help solve the problem, please email the URL to stecue@gmail.com. Thanks!\n本页面可能与FixCJK!冲突，如果您想帮忙解决此问题，请将本页面的URL电邮至stecue@gmail.com。多谢您的使用与反馈！");
            }
        }
        function getBefore(child) {
            var t_start=performance.now();
            var toReturn='';
            while (child.textContent === child.parentNode.textContent && !child.parentNode.nodeName.match(upEnoughTags)) {
                child=child.parentNode;
            }
            child=child.previousSibling;
            while (child && (performance.now()-t_start<2) ) {
                if (child.nodeType===3) {
                    if (debug_tagSeeThrough===true) console.log("T3: "+child.data);
                    toReturn = child.data + toReturn;
                    if (toReturn.length>1024) {
                        //Stop if to Return is already too long;
                        break;
                    }
                }
                else if (child.nodeType===1) {
                    if (debug_tagSeeThrough===true) console.log("T1: "+child.textContent);
                    toReturn = child.textContent + toReturn;
                    if (toReturn.length>1024) {
                        //Stop if to Return is already too long;
                        break;
                    }
                }
                child=child.previousSibling;
            }
            if (debug_tagSeeThrough===true) console.log("BEFORE: "+toReturn+"@"+performance.now());
            return (toReturn.replace(/</,'&lt;')).replace(/>/,'&gt;');
        }
        function getAfter(child) {
            var toReturn='';
            var t_start=performance.now();
            while (child.textContent === child.parentNode.textContent && !child.parentNode.nodeName.match(upEnoughTags)) {
                child=child.parentNode;
            }
            child=child.nextSibling;
            while (child && (performance.now()-t_start<2) ) {
                if (child.nodeType===3) {
                    toReturn = toReturn + child.data;
                    if (toReturn.length>1024) {
                        //Stop if to Return is already too long;
                        break;
                    }
                }
                else if (child.nodeType===1) {
                    toReturn = toReturn + child.textContent;
                    if (toReturn.length>1024) {
                        //Stop if to Return is already too long;
                        break;
                    }
                }
                child=child.nextSibling;
            }
            if (debug_tagSeeThrough===true) console.log("AFTER: "+toReturn+"@"+performance.now());
            return (toReturn.replace(/</,'&lt;')).replace(/>/,'&gt;');
        }
        //==We need to protect the quotation marks within tags first===//
        // \uE862,\uE863 <==> ‘,’
        // \uE972,\uE973 <==> “,”
        while (currHTML.match(/<[^>]*[“”‘’、，。：；！？）】〉》」』『「《〈【（][^<]*>/m)) {
            currHTML=currHTML.replace(/(<[^>]*)‘([^<]*>)/mg,'$1\uE862$2');
            currHTML=currHTML.replace(/(<[^>]*)’([^<]*>)/mg,'$1\uE863$2');
            currHTML=currHTML.replace(/(<[^>]*)“([^<]*>)/mg,'$1\uE972$2');
            currHTML=currHTML.replace(/(<[^>]*)”([^<]*>)/mg,'$1\uE973$2');
            currHTML=currHTML.replace(/(<[^>]*)、([^<]*>)/mg,'$1\uEA01$2');
            currHTML=currHTML.replace(/(<[^>]*)，([^<]*>)/mg,'$1\uEA02$2');
            currHTML=currHTML.replace(/(<[^>]*)。([^<]*>)/mg,'$1\uEA03$2');
            currHTML=currHTML.replace(/(<[^>]*)：([^<]*>)/mg,'$1\uEA04$2');
            currHTML=currHTML.replace(/(<[^>]*)；([^<]*>)/mg,'$1\uEA05$2');
            currHTML=currHTML.replace(/(<[^>]*)！([^<]*>)/mg,'$1\uEA06$2');
            currHTML=currHTML.replace(/(<[^>]*)？([^<]*>)/mg,'$1\uEA07$2');
            currHTML=currHTML.replace(/(<[^>]*)）([^<]*>)/mg,'$1\uEA08$2');
            currHTML=currHTML.replace(/(<[^>]*)】([^<]*>)/mg,'$1\uEA09$2');
            currHTML=currHTML.replace(/(<[^>]*)〉([^<]*>)/mg,'$1\uEA10$2');
            currHTML=currHTML.replace(/(<[^>]*)》([^<]*>)/mg,'$1\uEA11$2');
            currHTML=currHTML.replace(/(<[^>]*)」([^<]*>)/mg,'$1\uEA12$2');
            currHTML=currHTML.replace(/(<[^>]*)』([^<]*>)/mg,'$1\uEA13$2');
            currHTML=currHTML.replace(/(<[^>]*)『([^<]*>)/mg,'$1\uEA14$2');
            currHTML=currHTML.replace(/(<[^>]*)「([^<]*>)/mg,'$1\uEA15$2');
            currHTML=currHTML.replace(/(<[^>]*)《([^<]*>)/mg,'$1\uEA16$2');
            currHTML=currHTML.replace(/(<[^>]*)〈([^<]*>)/mg,'$1\uEA17$2');
            currHTML=currHTML.replace(/(<[^>]*)【([^<]*>)/mg,'$1\uEA18$2');
            currHTML=currHTML.replace(/(<[^>]*)（([^<]*>)/mg,'$1\uEA19$2');
        }
        var time2protect=performance.now()-FixMarks_start;
        //Now let's fix the punctions.
        //First we need to fix the "reverse-paired" punctuations.
        var fixpair=false; //the current code has problems if unpaired quotation marks are present.
        var fixpair_timeout = noBonusTimeout; //Don't spend too much time on this "bonus" function.
        var fixpair_start=performance.now();
        if ( currHTML.length > noBonusLength ) {fixpair=false;}
        if (debug_re_to_check===true && (currHTML.match(re_to_check))) {console.log("Reversing "+currHTML);}
        if (fixpair===true) { //[\w,./<>?;:[]\{}|`~!@#$%^&*()_+-=]*
            var revpaired=/(^[^\u201C\u201D]?(?:[^\u201C\u201D]*\u201C[^\u201C\u201D]*\u201D)*[^\u201C\u201D]*)\u201D([^\u201C\u201D]{2,})\u201C/;
            while (currHTML.match(revpaired) && (performance.now()-fixpair_start)<fixpair_timeout ) {
                if (debug_re_to_check===true && currHTML.match(re_to_check)) {console.log("Pair reversed: "+(performance.now()-t_start).toString());}
                currHTML=currHTML.replace(revpaired,'$1\u201C$2\u201D');
            }
        }
        var fixpair_stop=performance.now()-fixpair_start;
        var paired_start=performance.now();
        //Find and preserve paired Latin marks.
        var paired=/(\u201C)([^\u3000-\u303F\u3400-\u9FBF\uE000-\uED00\uFF00-\uFFEF]*)(\u201D)/mg;
        while (currHTML.match(paired)) {
            if (debug_re_to_check===true && currHTML.match(re_to_check)) console.log("Quotation mark pair found@"+currHTML);
            currHTML=currHTML.replace(paired,'\uEC1C$2\uEC1D');
        }
        //Find paired CJK marks. Seems like O(n^2) without the "g" modifier?
        paired=/(\u201C)([^\u201D]*[\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF][^\u201D]*)(\u201D)/mg;
        while (currHTML.match(paired)) {
            currHTML=currHTML.replace(paired,'\uEB1C$2\uEB1D');
        }
        var paired_stop=performance.now()-paired_start;
        //"unpaired \u201C or \u201D", not just use at the beginning of a paragraph.
        var unpaired_timeout = noBonusTimeout; //not so important, therefore cannot spend too much time here.
        var unpaired_start=performance.now();
        var unpaired=/\u201C((?:[\uF201-\uF204]CJK[\uF201-\uF204])?[^\u201D\u3400-\u9FBF\uF201-\uF204]{0,3}[\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF][^\u201C\u201D]*$)/m;
        while ( currHTML.length< noBonusLength && currHTML.match(unpaired) && (performance.now()-unpaired_start)<unpaired_timeout) {
            currHTML=currHTML.replace(unpaired,'\uEB1C$1'); //We need the greedy method to get the longest match.
        }
        unpaired=/(^[^\u201C\u201D]*[\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF](?:[\uF201-\uF204]CJK[\uF201-\uF204])?[^\u201D\u3400-\u9FBF\uF201-\uF204]{0,3}(?:[\uF201-\uF204]CJK[\uF201-\uF204])?)\u201D/m;
        while ( currHTML.length< noBonusLength && currHTML.match(unpaired) && (performance.now()-unpaired_start)<unpaired_timeout) {
            currHTML=currHTML.replace(unpaired,'$1\uEB1D'); //We need the greedy method to get the longest match.
        }
        //For single quotations:
        var paired_single_start=performance.now();
        paired=/(\u2018)([^\u2019]*[\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF][^\u2019]*)(\u2019)/mg;
        while (currHTML.match(paired)) {
            currHTML=currHTML.replace(paired,'\uEB18$2\uEB19');
        }
        var paired_single_stop=performance.now()-paired_single_start;
        //"unpaired ‘ (\u2018)", not just use at the beginning of a paragraph.
        unpaired_start=performance.now();
        unpaired=/\u2018((?:[\uF201-\uF204]CJK[\uF201-\uF204])?[^\u201D\u3400-\u9FBF\uF201-\uF204]{0,3}(?:[\uF201-\uF204]CJK[\uF201-\uF204])?[\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF][^\u2018\u2019]*$)/m;
        while ( currHTML.length< noBonusLength && currHTML.match(unpaired) && (performance.now()-unpaired_start)<unpaired_timeout) {
            currHTML=currHTML.replace(unpaired,'\uEB18$1'); //We need the greedy method to get the longest match.
        }
        //CJK’, otherwise words like it's might be affected.
        unpaired=/(^[^\u2018\u2019]*[\u3000-\u303F\u3400-\u9FBF\uFF00-\uFFEF](?:[\uF201-\uF204]CJK[\uF201-\uF204])?)\u2019/m;
        while ( currHTML.length< noBonusLength && currHTML.match(unpaired) && (performance.now()-unpaired_start)<unpaired_timeout) {
            currHTML=currHTML.replace(unpaired,'$1\uEB19'); //We need the greedy method to get the longest match.
        }
        ///=== Unicode Shifting Ends ===///
        var time2shift=performance.now()-FixMarks_start-time2protect;
        //Remove extra spaces if necessary
        if (delete_all_extra_spaces===true) {
            //For changhai.org and similar sites.
            currHTML=currHTML.replace(/&nbsp;/g,'\u00A0');
            currHTML=currHTML.replace(/([、，。：；！？）】〉》」』\uEB1D\uEB19]+)(?:[\s\u00A0]|&nbsp;){0,2}/g,'$1');
            //'>' means there is a non-CJK tag(?)
            currHTML=currHTML.replace(/([^\s\u00A0>])(?:[\s\u00A0]|&nbsp;){0,2}([『「《〈【（\uEB1C\uEB18]+)/g,'$1$2');
        }
        else {
            //Delete at most 1 spaces before and after because of the wider CJK marks.
            currHTML=currHTML.replace(/([\uEB1D\uEB19])[ ]?/mg,'$1');
            currHTML=currHTML.replace(/[ ]?([\uEB1C\uEB18])/mg,'$1');
        }
        ///--Group Left: [、，。：；！？）】〉》」』\uEB1D\uEB19] //Occupies the left half width.
        ///--Group Right:[『「《〈【（\uEB1C\uEB18] //Occupies the right half width.
        ///=====Use \uE211 as the calss name for TWO-PUNCT RULES====//
        ///===Do not use the "g" modefier because we are using loops===//
        var reLL=/([\n]?[、，。：；！？）】〉》」』\uEB1D\uEB19][\n]?)([\uF201-\uF204]CJK[\uF201-\uF204])?([、，。：；！？）】〉》」』\uEB1D\uEB19])/m;
        var reLR=/([\n]?[、，。：；！？）】〉》」』\uEB1D\uEB19][\n]?)([\uF201-\uF204]CJK[\uF201-\uF204])?([『「《〈【（\uEB1C\uEB18])/m;
        var reRR=/([\n]?[『「《〈【（\uEB1C\uEB18][\n]?)([\uF201-\uF204]CJK[\uF201-\uF204])?([『「《〈【（\uEB1C\uEB18])/m;
        var reRL=/([\n]?[『「《〈【（\uEB1C\uEB18][\n]?)([\uF201-\uF204]CJK[\uF201-\uF204])?([、，。：；！？）】〉》」』\uEB1D\uEB19])/m;
        var sqz_start=performance.now();
        while (currHTML.match(/(?:[、，。：；！？）】〉》」』\uEB1D\uEB19『「《〈【（\uEB1C\uEB18]([\uF201-\uF204]CJK[\uF201-\uF204])?){2,}/m) && (performance.now()-sqz_start)<sqz_timeout) {
            if (currHTML.match(reLL)) {
                //--TWO PUNCTS: {Left}{Left}--//
                tmp_str='<span class="CJKVisited MarksFixedE135 \uE211" style="display:inline;padding-left:0px;padding-right:0px;float:none;letter-spacing:'+kern_consec_ll+';">$1</span>$2$3';
                currHTML=currHTML.replace(reLL,tmp_str);
            }
            else if (currHTML.match(reLR)) {
                //--TWO PUNCTS: {Left}{Right}--//
                tmp_str='<span class="CJKVisited MarksFixedE135 \uE211" style="display:inline;padding-left:0px;padding-right:0px;float:none;letter-spacing:'+kern_consec_lr+';">$1</span>$2$3';
                currHTML=currHTML.replace(reLR,tmp_str);
            }
            else if (currHTML.match(reRR)) {
                //--TWO PUNCTS: {Right}{Right}--//
                tmp_str='<span class="CJKVisited MarksFixedE135 \uE211" style="display:inline;padding-left:0px;padding-right:0px;float:none;letter-spacing:'+kern_consec_rr+';">$1</span>$2$3';
                currHTML=currHTML.replace(reRR,tmp_str);
            }
            else if (currHTML.match(reRL)) {
                //--TWO PUNCTS: no letter-spacing adjustment for {Right}-{Left}--//
                currHTML=currHTML.replace(reRL,'$1<wbr>$2$3');
            }
            else {
                console.log("FIXME: current combination of punctuations has not been considered!");
                break;
            }
        }
        ///---Done with conseqtive puncts--///
        if (debug_04===true) {all[currpunc].style.color="Pink";}
        if (SqueezeInd===true) {
            //The punctuation marks is also the first char in a paragraph seems:
            //In current model (1.0.x), all tags are added within this function (FixMarksInCurrHTML), and it should be safe to skip them.
            currHTML=currHTML.replace(/^([\uF201-\uF204]CJK[\uF201-\uF204])?(<[^><]*>)*([『「《〈【（\uEB1C\uEB18])/mg,'$1$2<span class="CJKVisited MarksFixedE135 \uE211" style="display:inline;padding-left:0px;padding-right:0px;float:none;margin-left:'+kern_ind_open+';">$3</span>');
            //Then, not the first char: 
            if (performSingleRightSqueeze===true) {
                currHTML=currHTML.replace(/([^><、，。：；！？）】〉》」』\uEB1D\uEB19『「《〈【（\uEB1C\uEB18\uF201-\uF204])((?:<[^><]*>)*(?:[\uF201-\uF204]CJK[\uF201-\uF204])?(?:<[^><]*>)*)([『「《〈【（\uEB1C\uEB18])((?:<[^><]*>)*(?:[\uF201-\uF204]CJK[\uF201-\uF204])?(?:<[^><]*>)*(?:[\uF201-\uF204]CJK[\uF201-\uF204])?)([^><、，。：；！？）】〉》」』\uEB1D\uEB19『「《〈【（\uEB1C\uEB18\uF201-\uF204]|$)/mg,'$1$2<span class="CJKVisited MarksFixedE135 \uE211" style="display:inline;padding-left:0px;padding-right:0px;float:none;margin-left:'+kern_ind_open+';">$3</span>$4$5');
            }
            //Do not squeeze the last punctuation marks in a paragraph. Too risky.
            currHTML=currHTML.replace(/([、，。：；！？）】〉》」』\uEB1D\uEB19])([<[^\uE211]*>]|[^><])/mg,'<span class="CJKVisited MarksFixedE135 \uE211" style="display:inline;padding-left:0px;padding-right:0px;float:none;margin-right:'+kern_ind_close+';">$1</span>$2');
        }
        ///=== Squeezing Ends ===///
        var time2squeeze=performance.now()-FixMarks_start-time2shift-time2protect;
        ///=== Change the protected punctuations in tags back==///
        currHTML=currHTML.replace(/\uE862/mg,'\u2018');
        currHTML=currHTML.replace(/\uE863/mg,'\u2019');
        currHTML=currHTML.replace(/\uE972/mg,'\u201C');
        currHTML=currHTML.replace(/\uE973/mg,'\u201D');
        currHTML=currHTML.replace(/\uEA01/mg,'、');
        currHTML=currHTML.replace(/\uEA02/mg,'，');
        currHTML=currHTML.replace(/\uEA03/mg,'。');
        currHTML=currHTML.replace(/\uEA04/mg,'：');
        currHTML=currHTML.replace(/\uEA05/mg,'；');
        currHTML=currHTML.replace(/\uEA06/mg,'！');
        currHTML=currHTML.replace(/\uEA07/mg,'？');
        currHTML=currHTML.replace(/\uEA08/mg,'）');
        currHTML=currHTML.replace(/\uEA09/mg,'】');
        currHTML=currHTML.replace(/\uEA10/mg,'〉');
        currHTML=currHTML.replace(/\uEA11/mg,'》');
        currHTML=currHTML.replace(/\uEA12/mg,'」');
        currHTML=currHTML.replace(/\uEA13/mg,'』');
        currHTML=currHTML.replace(/\uEA14/mg,'『');
        currHTML=currHTML.replace(/\uEA15/mg,'「');
        currHTML=currHTML.replace(/\uEA16/mg,'《');
        currHTML=currHTML.replace(/\uEA17/mg,'〈');
        currHTML=currHTML.replace(/\uEA18/mg,'【');
        currHTML=currHTML.replace(/\uEA19/mg,'（');
        ///////==== Change quotation marks back =====/////
        currHTML=currHTML.replace(/\uEC1C/mg,'\u201C');
        currHTML=currHTML.replace(/\uEC1D/mg,'\u201D');
        currHTML=currHTML.replace(/\uEB1C/mg,'<span class="CJKVisited MarksFixedE135 \uE985" style="display:inline;padding-left:0px;padding-right:0px;float:none;font-family:'+dequote(CJKPunct)+';">\u201C</span>');
        currHTML=currHTML.replace(/\uEB1D/mg,'<span class="CJKVisited MarksFixedE135 \uE985" style="display:inline;padding-left:0px;padding-right:0px;float:none;font-family:'+dequote(CJKPunct)+';">\u201D</span>');
        currHTML=currHTML.replace(/\uEB18/mg,'<span class="CJKVisited MarksFixedE135 \uE985" style="display:inline;padding-left:0px;padding-right:0px;float:none;font-family:'+dequote(CJKPunct)+';">\u2018</span>');
        currHTML=currHTML.replace(/\uEB19/mg,'<span class="CJKVisited MarksFixedE135 \uE985" style="display:inline;padding-left:0px;padding-right:0px;float:none;font-family:'+dequote(CJKPunct)+';">\u2019</span>');
        ///=== Replacing and Restoring Ends ===///
        var time2replace=performance.now()-FixMarks_start-time2squeeze-time2shift-time2protect;
        if ( (performance.now()-FixMarks_start)>200 ) {
            console.log("FIXME: String Operation Too Slow: "+(performance.now()-FixMarks_start).toFixed(0)+" ms.");
            console.log("Protect: "+time2protect.toFixed(0)+" ms.");
            console.log("Shift:   "+time2shift.toFixed(0)+" ms.");
            console.log(" ----->rev: "+fixpair_stop.toFixed(0)+" ms.");
            console.log(" ----->\u201C,\u201D: "+paired_stop.toFixed(0)+" ms.");
            console.log(" ----->\u2018,\u2019: "+paired_single_stop.toFixed(0)+" ms.");
            console.log("Squeeze: "+time2squeeze.toFixed(0)+" ms.");
            console.log("Replace: "+time2replace.toFixed(0)+" ms.");
            console.log("String(Length): "+currHTML.slice(0,216)+"...("+currHTML.length+")");
        }
        if (debug_tagSeeThrough===true) {console.log("FIXED: "+currHTML+"@"+performance.now());}
        currHTML=currHTML.replace(/^[^\u0000]*\uF201CJK\uF201([^\u0000]*)$/,'$1');
        currHTML=currHTML.replace(/^([^\u0000]*)\uF202CJK\uF202[^\u0000]*$/,'$1');
        if (debug_tagSeeThrough===true) console.log("AFTER TRIMMED: "+currHTML+"@"+performance.now());
        return currHTML;
    }
}
) ();
