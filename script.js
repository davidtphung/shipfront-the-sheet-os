/* THE SHEET OS. Local only. No fetch. No analytics. */
/* Motion budget: transform and opacity. Critically damped springs. Every run interruptible. */

(function () {
  "use strict";

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function reduced() {
    return reduceQuery.matches;
  }

  var TAU = Math.PI * 2;

  /* Critically damped spring. Bounce 0. Reads its live value, so a retarget mid-flight
     never snaps and never locks input. */
  function Spring(options) {
    this.value = options.from || 0;
    this.target = this.value;
    this.velocity = 0;
    this.response = options.response || 0.35;
    this.damping = options.damping == null ? 1 : options.damping;
    this.epsilon = options.epsilon || 0.001;
    this.onUpdate = options.onUpdate;
    this.onRest = options.onRest || null;
    this.frame = 0;
    this.stamp = 0;
    this.onUpdate(this.value);
  }

  Spring.prototype.stop = function () {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  };

  Spring.prototype.set = function (value, velocity) {
    this.stop();
    this.value = value;
    this.target = value;
    this.velocity = velocity || 0;
    this.onUpdate(this.value);
  };

  Spring.prototype.hold = function (value, velocity) {
    this.stop();
    this.value = value;
    if (velocity != null) this.velocity = velocity;
    this.onUpdate(this.value);
  };

  Spring.prototype.to = function (target, velocity) {
    this.target = target;
    if (velocity != null) this.velocity = velocity;
    if (this.frame) return;
    this.stamp = 0;
    var self = this;
    this.frame = requestAnimationFrame(function (now) {
      self.stamp = now;
      self.tick(now);
    });
  };

  Spring.prototype.tick = function (now) {
    var elapsed = Math.min((now - this.stamp) / 1000, 0.064);
    this.stamp = now;

    var omega = TAU / this.response;
    var steps = Math.max(1, Math.ceil(elapsed / 0.004));
    var h = elapsed / steps;

    for (var i = 0; i < steps; i += 1) {
      var accel = -omega * omega * (this.value - this.target) - 2 * this.damping * omega * this.velocity;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }

    if (
      Math.abs(this.value - this.target) < this.epsilon &&
      Math.abs(this.velocity) < this.epsilon * 12
    ) {
      this.frame = 0;
      this.value = this.target;
      this.velocity = 0;
      this.onUpdate(this.value);
      if (this.onRest) this.onRest();
      return;
    }

    this.onUpdate(this.value);
    var self = this;
    this.frame = requestAnimationFrame(function (stamp) {
      self.tick(stamp);
    });
  };

  /* Reveal. Rest is the image. The still never springs. */

  var revealables = document.querySelectorAll("[data-reveal], [data-clip]");

  if (revealables.length) {
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(revealables, function (el) {
        el.classList.add("is-in");
      });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
      Array.prototype.forEach.call(revealables, function (el) {
        revealObserver.observe(el);
      });
    }
  }

  /* Floating nav. Rides free over the hero, compacts onto a plate after scroll,
     springs out of the way on the way down and back on the way up. */

  var header = document.querySelector("[data-nav]");

  if (header) {
    var navSpring = new Spring({
      from: 0,
      response: 0.4,
      damping: 1,
      epsilon: 0.2,
      onUpdate: function (value) {
        header.style.transform = value ? "translateY(" + value + "px)" : "";
      }
    });

    var lastY = window.pageYOffset;
    var navQueued = false;
    var navHidden = false;

    var readScroll = function () {
      navQueued = false;
      var y = Math.max(0, window.pageYOffset);
      var delta = y - lastY;

      header.classList.toggle("is-compact", y > 24);

      if (!reduced() && !document.body.classList.contains("is-sheet-open")) {
        var height = header.offsetHeight + 24;
        if (!navHidden && y > height * 3 && delta > 6) {
          navHidden = true;
          navSpring.to(-height);
        } else if (navHidden && (delta < -6 || y < height)) {
          navHidden = false;
          navSpring.to(0);
        }
      } else if (navHidden) {
        navHidden = false;
        navSpring.to(0);
      }

      lastY = y;
    };

    window.addEventListener(
      "scroll",
      function () {
        if (navQueued) return;
        navQueued = true;
        requestAnimationFrame(readScroll);
      },
      { passive: true }
    );

    readScroll();
  }

  /* Press. Feedback lands on pointer-down at 0.97, then settles. */

  function pressable(el, low) {
    var floor = low == null ? 0.97 : low;
    var spring = new Spring({
      from: 1,
      response: 0.34,
      damping: 1,
      epsilon: 0.0006,
      onUpdate: function (value) {
        el.style.transform = value === 1 ? "" : "scale(" + value + ")";
      }
    });
    var down = false;

    function press(event) {
      if (event.button != null && event.button !== 0) return;
      down = true;
      var tile = el.closest ? el.closest("[data-tile]") : null;
      if (tile) tile.classList.add("is-pressed");
      if (reduced()) return;
      spring.response = 0.14;
      spring.to(floor);
    }

    function release() {
      if (!down) return;
      down = false;
      var tile = el.closest ? el.closest("[data-tile]") : null;
      if (tile) tile.classList.remove("is-pressed");
      if (reduced()) {
        spring.set(1);
        return;
      }
      spring.response = 0.36;
      spring.to(1);
    }

    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
    window.addEventListener("pointerup", release);
    el.addEventListener("keydown", function (event) {
      if (event.key === " " || event.key === "Enter") press({ button: 0 });
    });
    el.addEventListener("keyup", release);
    el.addEventListener("blur", release);
  }

  Array.prototype.forEach.call(
    document.querySelectorAll(".cta, .net-item, .net-key, .flow-stop"),
    function (el) {
      pressable(el);
    }
  );

  /* Sheets. Quote and menu ride one interruptible path. Enter and exit share a track. */

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href], button:not([tabindex="-1"]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) {
        return !el.hasAttribute("hidden") && el.offsetParent !== null;
      }
    );
  }

  function Sheet(root) {
    this.root = root;
    this.panel = root.querySelector("[data-sheet-panel]");
    this.scrim = root.querySelector(".sheet-scrim");
    this.grab = root.querySelector("[data-sheet-grab]");
    this.open = false;
    this.height = 0;
    this.returnTo = null;
    this.drag = null;

    var self = this;
    this.spring = new Spring({
      from: 0,
      response: 0.36,
      damping: 1,
      epsilon: 0.35,
      onUpdate: function (value) {
        self.paint(value);
      },
      onRest: function () {
        if (!self.open) self.park();
      }
    });

    root.addEventListener("click", function (event) {
      var hit = event.target.closest ? event.target.closest("[data-sheet-dismiss]") : null;
      if (hit) self.close();
    });

    this.panel.addEventListener("pointerdown", function (event) {
      self.grabStart(event);
    });

    document.addEventListener("keydown", function (event) {
      if (!self.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        self.close();
        return;
      }
      if (event.key === "Tab") self.trap(event);
    });
  }

  Sheet.prototype.paint = function (y) {
    var clamped = Math.max(0, y);
    this.panel.style.transform = "translate(-50%, " + y + "px)";
    if (this.scrim && this.height) {
      this.scrim.style.opacity = String(Math.max(0, 1 - clamped / this.height));
    }
  };

  Sheet.prototype.park = function () {
    this.root.classList.remove("is-live");
    this.root.setAttribute("hidden", "");
    this.root.style.opacity = "";
    this.root.style.transition = "";
    document.body.classList.remove("is-sheet-open");
    if (this.returnTo && this.returnTo.focus) this.returnTo.focus();
    this.returnTo = null;
  };

  Sheet.prototype.show = function (trigger) {
    if (this.open) return;
    this.open = true;
    this.returnTo = trigger || document.activeElement;
    this.root.removeAttribute("hidden");
    this.root.classList.add("is-live");
    document.body.classList.add("is-sheet-open");
    this.height = this.panel.offsetHeight + 32;

    if (reduced()) {
      this.spring.set(0);
      if (this.scrim) this.scrim.style.opacity = "1";
      this.root.style.transition = "opacity 200ms linear";
      this.root.style.opacity = "0";
      var root = this.root;
      requestAnimationFrame(function () {
        root.style.opacity = "1";
      });
    } else {
      this.spring.set(this.height);
      this.spring.to(0);
    }

    this.panel.focus({ preventScroll: true });
  };

  Sheet.prototype.close = function (velocity) {
    if (!this.open) return;
    this.open = false;

    if (reduced()) {
      var self = this;
      this.root.style.transition = "opacity 200ms linear";
      this.root.style.opacity = "0";
      window.setTimeout(function () {
        if (!self.open) self.park();
      }, 200);
      return;
    }

    this.spring.response = 0.34;
    this.spring.to(this.height, velocity);
  };

  Sheet.prototype.trap = function (event) {
    var list = focusables(this.panel);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /* Rubber band above the rest point. Capped, so an overdrag never runs away. */
  function band(distance, limit) {
    var c = 0.55;
    return (distance * c * limit) / (limit + c * distance);
  }

  Sheet.prototype.grabStart = function (event) {
    if (!this.open || event.button !== 0) return;
    var target = event.target;
    var interactive = target.closest ? target.closest("input, textarea, select, button, a, label") : null;
    var onGrab = this.grab && target.closest && target.closest("[data-sheet-grab]");
    if (interactive && !onGrab) return;
    if (!onGrab && this.panel.scrollTop > 0) return;
    if (reduced()) return;

    /* Take over mid-flight from the live presentation value. */
    this.spring.hold(this.spring.value, 0);

    this.drag = {
      id: event.pointerId,
      startY: event.clientY,
      base: this.spring.value,
      lastY: event.clientY,
      lastAt: event.timeStamp || performance.now(),
      velocity: 0
    };

    try {
      this.panel.setPointerCapture(event.pointerId);
    } catch (err) {
      /* capture is a nicety, not a requirement */
    }

    var self = this;

    this.onMove = function (move) {
      if (!self.drag || move.pointerId !== self.drag.id) return;
      var delta = move.clientY - self.drag.startY;
      var next = self.drag.base + delta;
      if (next < 0) next = -band(-next, Math.max(120, self.height * 0.5));
      var at = move.timeStamp || performance.now();
      var span = at - self.drag.lastAt;
      if (span > 0) {
        self.drag.velocity = ((move.clientY - self.drag.lastY) / span) * 1000;
        self.drag.lastY = move.clientY;
        self.drag.lastAt = at;
      }
      self.spring.hold(next, self.drag.velocity);
    };

    this.onUp = function (up) {
      if (!self.drag || up.pointerId !== self.drag.id) return;
      var velocity = self.drag.velocity;
      var resting = self.spring.value;
      self.drag = null;
      window.removeEventListener("pointermove", self.onMove);
      window.removeEventListener("pointerup", self.onUp);
      window.removeEventListener("pointercancel", self.onUp);

      /* Velocity handoff. A flick or a drag past the line dismisses, otherwise it settles home. */
      if (velocity > 750 || resting > self.height * 0.32) {
        self.close(velocity);
      } else {
        self.spring.response = 0.36;
        self.spring.to(0, velocity);
      }
    };

    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  };

  var quoteRoot = document.querySelector('[data-sheet="quote"]');
  var menuRoot = document.querySelector('[data-sheet="menu"]');
  var menuToggle = document.querySelector("[data-menu-toggle]");
  var quoteSheet = quoteRoot ? new Sheet(quoteRoot) : null;
  var menuSheet = menuRoot ? new Sheet(menuRoot) : null;
  var mobile = window.matchMedia("(max-width: 720px)");

  if (menuSheet && menuToggle) {
    var syncToggle = function () {
      menuToggle.setAttribute("aria-expanded", menuSheet.open ? "true" : "false");
    };

    menuToggle.addEventListener("click", function () {
      if (menuSheet.open) {
        menuSheet.close();
      } else {
        menuSheet.show(menuToggle);
      }
      syncToggle();
    });

    menuRoot.addEventListener("click", syncToggle);
    document.addEventListener("keyup", syncToggle);

    var leaveMobile = function () {
      if (!mobile.matches && menuSheet.open) {
        menuSheet.open = false;
        menuSheet.spring.set(0);
        menuSheet.park();
        syncToggle();
      }
    };

    if (mobile.addEventListener) {
      mobile.addEventListener("change", leaveMobile);
    } else if (mobile.addListener) {
      mobile.addListener(leaveMobile);
    }
  }

  if (quoteSheet) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-quote]"), function (link) {
      link.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        if (menuSheet && menuSheet.open) {
          menuSheet.close();
          if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
        }
        quoteSheet.show(link);
      });
    });
  }

  /* Network. Hover, focus, and press all land on the same state.
     No scroll hijack: the section is a plain sticky track. */

  (function network() {
    var stage = document.querySelector(".network-stage");
    if (!stage) return;

    var svg = stage.querySelector(".net-svg");
    var nodes = stage.querySelectorAll(".net-node");
    var links = stage.querySelectorAll(".net-link");
    var controls = stage.querySelectorAll("[data-node-key]");
    var readoutKey = document.querySelector("[data-readout-key]");
    var readoutBody = document.querySelector("[data-readout-body]");
    var readoutIndex = document.querySelector("[data-readout-index]");
    var order = ["store", "inventory", "fulfillment", "quality", "carrier", "customer"];

    if (!controls.length) return;

    var copy = {};
    Array.prototype.forEach.call(stage.querySelectorAll(".net-item"), function (item) {
      copy[item.getAttribute("data-node-key")] = {
        key: item.querySelector(".nk").textContent,
        body: item.querySelector(".nb").textContent
      };
    });

    var pinned = "store";

    function paint(active) {
      if (svg) svg.classList.add("has-active");

      Array.prototype.forEach.call(nodes, function (node) {
        node.classList.toggle("is-on", node.getAttribute("data-node") === active);
      });

      Array.prototype.forEach.call(links, function (link) {
        var touches = (" " + link.getAttribute("data-link") + " ").indexOf(" " + active + " ") > -1;
        link.classList.toggle("is-on", touches);
      });

      Array.prototype.forEach.call(controls, function (control) {
        control.setAttribute(
          "aria-pressed",
          control.getAttribute("data-node-key") === active ? "true" : "false"
        );
      });

      var entry = copy[active];
      if (entry && readoutKey && readoutBody) {
        readoutKey.textContent = entry.key;
        readoutBody.textContent = entry.body;
      }
      if (readoutIndex) {
        var at = order.indexOf(active);
        readoutIndex.textContent = at < 0 ? "" : (at + 1 < 10 ? "0" : "") + (at + 1);
      }
    }

    function preview(key) {
      paint(key);
    }

    function commit(key) {
      pinned = key;
      paint(key);
    }

    Array.prototype.forEach.call(controls, function (control) {
      var key = control.getAttribute("data-node-key");
      control.addEventListener("click", function () {
        commit(key);
      });
      /* Keyboard equals hover. */
      control.addEventListener("focus", function () {
        commit(key);
      });
      control.addEventListener("pointerenter", function () {
        preview(key);
      });
      control.addEventListener("pointerleave", function () {
        paint(pinned);
      });
    });

    Array.prototype.forEach.call(nodes, function (node) {
      var key = node.getAttribute("data-node");
      node.addEventListener("pointerenter", function () {
        preview(key);
      });
      node.addEventListener("click", function () {
        commit(key);
      });
      node.style.cursor = "pointer";
    });

    if (svg) {
      svg.addEventListener("pointerleave", function () {
        paint(pinned);
      });
    }

    paint(pinned);
  })();

  /* Order flow. The illustrative panel walks the seven stations on its own.
     A pointer on the figure holds the current station. Reduced motion stays put. */

  (function flowCycle() {
    var fig = document.querySelector(".flow");
    if (!fig) return;

    var names = ["store", "order", "inventory", "pick", "pack", "ship", "deliver"];
    var labels = {
      store: "Storefront",
      order: "Inbound",
      inventory: "Racked and counted",
      pick: "On our floor",
      pack: "Label on",
      ship: "Carrier",
      deliver: "Customer"
    };
    var now = fig.querySelector("[data-flow-now]");
    var index = 0;
    var paused = false;

    function paint(name) {
      var nodes = fig.querySelectorAll("[data-station]");
      for (var n = 0; n < nodes.length; n += 1) {
        nodes[n].classList.toggle("is-hot", nodes[n].getAttribute("data-station") === name);
      }
      if (now) now.textContent = labels[name] || "";
    }

    paint(names[0]);
    if (reduced()) return;

    fig.addEventListener("pointerenter", function () {
      paused = true;
    });
    fig.addEventListener("pointerleave", function () {
      paused = false;
    });

    Array.prototype.forEach.call(fig.querySelectorAll(".flow-stop"), function (stop) {
      stop.addEventListener("click", function () {
        var name = stop.getAttribute("data-station");
        var at = names.indexOf(name);
        if (at > -1) index = at;
        paused = true;
        paint(name);
      });
    });

    window.setInterval(function () {
      if (paused) return;
      index = (index + 1) % names.length;
      paint(names[index]);
    }, 2400);
  })();

  /* Same-page scroll to Why Shipfront. */

  Array.prototype.forEach.call(document.querySelectorAll('a[href*="#why"]'), function (link) {
    link.addEventListener("click", function (event) {
      var url = new URL(link.href, window.location.href);
      if (url.pathname !== window.location.pathname && url.pathname !== window.location.pathname + "index.html") {
        return;
      }
      var target = document.getElementById("why");
      if (!target) return;
      event.preventDefault();
      if (menuSheet && menuSheet.open) menuSheet.close();
      target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
    });
  });

  /* Form. Name, email, company. Validated in the browser. Nothing is posted. */

  var success =
    "Thanks. Someone from Shipfront will reach out shortly. We'll ask about volume and what you ship then.";

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-sheet-form]"), function (form) {
    var scope = form.parentNode;
    var status = scope.querySelector("[data-form-status]") || document.getElementById("form-status");

    function setInvalid(input, on) {
      input.setAttribute("aria-invalid", on ? "true" : "false");
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var name = form.querySelector('[name="name"]');
      var email = form.querySelector('[name="email"]');
      var company = form.querySelector('[name="company"]');
      var fields = [name, email, company];
      var ok = true;

      fields.forEach(function (input) {
        var empty = !input.value.trim();
        setInvalid(input, empty);
        if (empty) ok = false;
      });

      if (!validEmail(email.value.trim())) {
        setInvalid(email, true);
        ok = false;
      }

      if (!status) return;

      if (!ok) {
        status.className = "form-status is-on";
        status.textContent = "Name, email, and company are required.";
        return;
      }

      status.className = "form-status is-on";
      status.textContent = success;
      form.reset();
      fields.forEach(function (input) {
        setInvalid(input, false);
      });
    });
  });
})();
