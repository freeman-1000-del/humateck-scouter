/*
[Humateck Developer Warning]
This file is the ONLY YouTube registration delivery line.
Allowed: use the Google OAuth result and deliver the customer-approved text to YouTube API.
Forbidden: review, block, judge, pre-validate, modify, auto-correct, add metadata logic, add hidden/admin/test menus, or create self-made registration errors.
Humateck is a delivery system. Google handles authentication. YouTube handles registration response.
Do not move this logic back into order.html.

Failover principle:
- Primary delivery path: localizations-only update.
- Backup delivery path: snippet + localizations update using the existing YouTube snippet.
- The backup path is not a reviewer. It only retries the same customer-approved delivery with a safer YouTube request shape.
*/
(function(){
  "use strict";

  function $(id){ return document.getElementById(id); }

  var COUNTRY_ORDER_70 = [
    "en","ja","ko","zh-CN","zh-TW","es","es-419","es-US","pt","pt-PT",
    "fr","fr-CA","de","it","ru","hi","ar","id","tr","vi",
    "th","fil","ms","nl","pl","uk","sv","no","da","fi",
    "el","ro","hu","cs","sk","bg","hr","sr","sr-Latn","sq",
    "mk","et","lv","lt","iw","fa","ur","bn","ta","te",
    "mr","gu","kn","ml","pa","ne","sw","af","am","az",
    "be","bs","ca","eu","gl","hy","ka","kk","km","lo"
  ];

  function showResult(message){
    var box = $("deliveryLog");
    if(box){
      box.value = message;
      box.scrollTop = box.scrollHeight;
    }
  }

  function setButtonBusy(isBusy){
    var btn = $("sendOrderBtn") || $("youtubeRegisterBtn");
    if(!btn) return;
    btn.disabled = !!isBusy;
    btn.textContent = isBusy ? "Registration in Progress" : "YouTube Multilingual Registration";
  }

  function getValue(ids){
    for(var i=0;i<ids.length;i++){
      var el = $(ids[i]);
      if(el && typeof el.value === "string" && el.value.trim()) return el.value.trim();
    }
    return "";
  }

  function getAccessToken(){
    if(window.humateckGoogleAccessToken) return window.humateckGoogleAccessToken;
    try{
      var saved = sessionStorage.getItem("humateckGoogleAccessToken");
      if(saved) return saved;
    }catch(e){}
    return getValue(["googleAccessToken","accessToken","oauthAccessToken","authToken"]);
  }

  function getVideoUrl(){ return getValue(["videoUrl", "sourceVideoUrl", "youtubeUrl"]); }
  function getFinalText(){ return getValue(["finalOutput", "finalText", "finalResultText"]); }
  function getNativeLanguageCode(){ return getValue(["nativeLanguageCode"]) || "en"; }
  function getNativeTitle(){ return getValue(["sourceTitle"]); }
  function getNativeDescription(){ return getValue(["sourceDescription"]); }

  function extractVideoId(value){
    var raw = String(value || "").trim();
    if(!raw) return "";
    if(/^[a-zA-Z0-9_-]{8,}$/.test(raw) && raw.indexOf("http") !== 0) return raw;
    try{
      var u = new URL(raw);
      if(u.hostname.indexOf("youtu.be") >= 0) return u.pathname.replace(/^\//, "").split("/")[0].trim();
      var v = u.searchParams.get("v");
      if(v) return v.trim();
      var parts = u.pathname.split("/").filter(Boolean);
      var idx = parts.indexOf("shorts");
      if(idx >= 0 && parts[idx + 1]) return parts[idx + 1].trim();
      idx = parts.indexOf("live");
      if(idx >= 0 && parts[idx + 1]) return parts[idx + 1].trim();
    }catch(e){}
    return raw;
  }

  function clean(v){ return String(v || "").replace(/^\s+|\s+$/g, ""); }
  function stripNumberAndCountryName(text){
    return String(text || "")
      .replace(/^\s*Number\s*:\s*.*$/gmi, "")
      .replace(/^\s*Country\s*Name\s*:\s*.*$/gmi, "");
  }

  /* 🛠️ [수정 완료] 맨 첫 줄에 나오는 첫 번째 국가 코드도 누락 없이 완벽히 세도록 로직 보완 */
  function parseLabeledCountryCode(finalText){
    var text = stripNumberAndCountryName(String(finalText || "").replace(/\r/g, "")).trim();
    
    // 줄바꿈 기호(\n) 의존성을 없애고 'Country Code :' 단어 자체로 안전하게 분할합니다.
    var parts = text.split(/\s*Country\s*Code\s*:\s*/i);
    var localizations = {};

    for(var i=1; i<parts.length; i++){
      var block = parts[i];
      var lines = block.split("\n");
      var code = clean(lines.shift() || "");
      if(!code) continue;
      var parsed = parseTitleDescription(lines.join("\n"));
      localizations[code] = parsed;
    }
    return localizations;
  }

  function parseCodeLineBlocks(finalText){
    var text = stripNumberAndCountryName(String(finalText || "").replace(/\r/g, ""));
    var localizations = {};
    var codes = COUNTRY_ORDER_70.slice();

    for(var i=0;i<codes.length;i++){
      var code = codes[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var nextCodes = codes.slice(i+1).map(function(c){ return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
      var end = nextCodes ? "(?=\\n\\s*(?:" + nextCodes + ")\\s*\\n|$)" : "(?=$)";
      var re = new RegExp("(?:^|\\n)\\s*(" + code + ")\\s*\\n([\\s\\S]*?)" + end, "i");
      var m = text.match(re);
      if(m){
        localizations[codes[i]] = parseTitleDescription(m[2]);
      }
    }
    return localizations;
  }

  function parseSequentialTitleDescription(finalText){
    var text = stripNumberAndCountryName(String(finalText || "").replace(/\r/g, ""));
    var localizations = {};
    var pattern = /(?:^|\n)\s*Title\s*:\s*([^\n]*)([\s\S]*?)(?=\n\s*Title\s*:|$)/gi;
    var match;
    var index = 0;
    while((match = pattern.exec(text)) && index < COUNTRY_ORDER_70.length){
      var title = clean(match[1]);
      var body = match[2] || "";
      var description = "";
      var d = body.search(/\n\s*Description\s*:/i);
      if(d >= 0){
        description = body.slice(d).replace(/^\n\s*Description\s*:\s*/i, "").replace(/\n+$/g, "");
      }else{
        description = body.replace(/^\n+/, "").replace(/\n+$/g, "");
      }
      localizations[COUNTRY_ORDER_70[index]] = { title: title, description: description };
      index++;
    }
    return localizations;
  }

  function parseTitleDescription(text){
    var source = String(text || "");
    var title = "";
    var description = "";
    var titleMatch = source.match(/(?:^|\n)\s*Title\s*:\s*([^\n]*)/i);
    if(titleMatch) title = clean(titleMatch[1]);
    var descMatch = source.match(/(?:^|\n)\s*Description\s*:\s*([\s\S]*)/i);
    if(descMatch) description = String(descMatch[1] || "").replace(/^\n+/, "").replace(/\n+$/g, "");
    return { title: title, description: description };
  }

  function chooseLocalizations(finalText){
    var first = parseLabeledCountryCode(finalText);
    if(Object.keys(first).length) return first;
    var second = parseCodeLineBlocks(finalText);
    if(Object.keys(second).length) return second;
    return parseSequentialTitleDescription(finalText);
  }

  async function youtubeJson(url, options){
    var res = await fetch(url, options || {});
    var data = await res.json().catch(function(){ return {}; });
    if(!res.ok){
      var msg = data && data.error && data.error.message ? data.error.message : "Temporary YouTube registration response was not accepted.";
      throw new Error(msg);
    }
    return data;
  }

  async function engineLocalizationsOnly(ctx){
    await youtubeJson("https://www.googleapis.com/youtube/v3/videos?part=localizations", {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + ctx.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: ctx.videoId, localizations: ctx.localizations })
    });
  }

  async function engineSnippetMerge(ctx){
    var existing = await youtubeJson(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet,localizations&id=" + encodeURIComponent(ctx.videoId),
      { headers: { Authorization: "Bearer " + ctx.token } }
    );
    var video = existing.items && existing.items[0] ? existing.items[0] : {};
    var snippet = video.snippet || {};
    var merged = Object.assign({}, video.localizations || {}, ctx.localizations || {});
    var body = {
      id: ctx.videoId,
      snippet: {
        title: getNativeTitle() || snippet.title || "",
        description: getNativeDescription() || snippet.description || "",
        categoryId: snippet.categoryId || "22",
        defaultLanguage: getNativeLanguageCode() || snippet.defaultLanguage || "en"
      },
      localizations: merged
    };
    await youtubeJson("https://www.googleapis.com/youtube/v3/videos?part=snippet,localizations", {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + ctx.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  async function deliver(){
    var started = Date.now();
    var token = getAccessToken();
    var videoId = extractVideoId(getVideoUrl());
    var finalText = getFinalText();
    var localizations = chooseLocalizations(finalText);
    var codes = Object.keys(localizations);
    var ctx = { token: token, videoId: videoId, localizations: localizations };

    setButtonBusy(true);
    showResult("YouTube multilingual registration is in progress.");

    try{
      try{
        await engineLocalizationsOnly(ctx);
      }catch(primaryError){
        await engineSnippetMerge(ctx);
      }
      var seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
      showResult(
        "Registration Results\n" +
        "Number of target registration languages: " + codes.length + " languages\n" +
        "Registration time: " + seconds + " seconds"
      );
    }catch(error){
      var message = error && error.message ? error.message : String(error || "Temporary registration delay occurred.");
      showResult(message);
    }finally{
      setButtonBusy(false);
    }
  }

  window.HumateckYouTubeRegister = {
    deliver: deliver,
    parse: chooseLocalizations
  };

  document.addEventListener("click", function(event){
    var btn = event.target.closest("#sendOrderBtn, #youtubeRegisterBtn");
    if(!btn) return;
    event.preventDefault();
    deliver();
  }, true);
})();
