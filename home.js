// Public homepage: profile, publications and career from Supabase, updated live when edited in the app.
(function () {
  "use strict";
  var config = window.DIARY_CONFIG;
  var client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  var status = document.getElementById("status");

  function text(id, value) {
    var element = document.getElementById(id);
    element.textContent = value || "";
    element.hidden = !value;
  }

  // Only http(s) links are rendered, so a stored "javascript:" URL can never run.
  function safeUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function renderProfile(profile) {
    var name = (profile && profile.display_name) || (profile && profile.display_name_en) || "";
    text("name", name);
    text("name-en", profile && profile.display_name && profile.display_name_en ? profile.display_name_en : "");
    text("headline", profile && profile.headline);
    document.title = name || "Profile";
    var description = document.querySelector('meta[name="description"]');
    if (profile && (profile.headline || profile.bio)) {
      description.setAttribute("content", (profile.headline || profile.bio).slice(0, 160));
    }

    var links = document.getElementById("links");
    links.replaceChildren();
    ((profile && profile.links) || []).forEach(function (link) {
      var href = safeUrl(link.url);
      if (!href) return;
      var item = document.createElement("li");
      var anchor = document.createElement("a");
      anchor.href = href;
      anchor.rel = "me noopener";
      anchor.textContent = link.label;
      item.append(anchor);
      links.append(item);
    });

    var bio = profile && profile.bio;
    document.getElementById("bio").textContent = bio || "";
    document.getElementById("about").hidden = !bio;
  }

  function renderItems(kind, items) {
    var section = document.getElementById(kind);
    var list = section.querySelector("ol");
    list.replaceChildren();
    items.forEach(function (item) {
      var row = document.createElement("li");
      var period = document.createElement("span");
      period.className = "period";
      period.textContent = item.period;
      var body = document.createElement("div");
      var title = document.createElement("div");
      title.className = "title";
      var href = item.url && safeUrl(item.url);
      if (href) {
        var anchor = document.createElement("a");
        anchor.href = href;
        anchor.rel = "noopener";
        anchor.textContent = item.title;
        title.append(anchor);
      } else {
        title.textContent = item.title;
      }
      body.append(title);
      if (item.detail) {
        var detail = document.createElement("div");
        detail.className = "detail";
        detail.textContent = item.detail;
        body.append(detail);
      }
      row.append(period, body);
      list.append(row);
    });
    section.hidden = items.length === 0;
  }

  function load() {
    return Promise.all([
      client.from("profiles").select("display_name, display_name_en, headline, bio, links").order("updated_at", { ascending: false }).limit(1),
      client.from("profile_items").select("id, kind, title, detail, period, url").order("sort_order").order("created_at"),
    ]).then(function (results) {
      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;
      renderProfile(results[0].data[0]);
      var items = results[1].data;
      renderItems("publication", items.filter(function (item) { return item.kind === "publication"; }));
      renderItems("career", items.filter(function (item) { return item.kind === "career"; }));
      status.textContent = "";
    });
  }

  function showError() {
    status.textContent = "読み込めませんでした。時間をおいて再読み込みしてください。";
  }

  var timer = null;
  function reloadSoon() {
    clearTimeout(timer);
    timer = setTimeout(function () { load().catch(showError); }, 200);
  }

  client
    .channel("homepage")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reloadSoon)
    .on("postgres_changes", { event: "*", schema: "public", table: "profile_items" }, reloadSoon)
    .subscribe(function (state) {
      if (state === "SUBSCRIBED") reloadSoon();
    });

  load().catch(showError);
})();
