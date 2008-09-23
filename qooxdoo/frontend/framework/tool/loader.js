window.qxloader =
{
  parts : %PARTS%,
  uris : %URIS%,
  boot : %BOOT%,

  runningParts : {},
  loadedParts : {},
  runningPackages : {},
  loadedPackages : {},
  runningScripts : {},
  loadedScripts : {},

  //Maps part names to array of callback descriptor structures. One structure for each 
  //callback interested in events for the part with given name.
  __callbacksByPartname : {},

  scriptQueue : [],
  inFlushQueue : false,


  /**
   * loads external scripts which are not defined in "this.parts"
   * 
   * @type member
   * @param name {String}
   * @param type {String} prefix of file, example: type-name.js
   * @param callback {Function}
   * @param self {Object} 
   * @return {void}
   */
  loadExternals : function (name, callback, self)
  {
    if (this.loadedParts[name])
    {
      if (callback) {
        callback.call(self);
      }

      return;
    }

    if (this.runningParts[name])
    {
      if (callback)
      {
        for (var i=0, a=this.__getCallbacksForPart(name), l=a.length; i<l; i++)
        {          
          if (a[i].callback == callback && a[i].self == self)
          {
            return;
          }
        }

        this.__getCallbacksForPart(name).push({
          callback : callback,
          self : self || null
        });
      }

      return;
    }

    this.runningParts[name] = true;

    this.scriptQueue.push.apply(this.scriptQueue, ["script/" + name + ".js"]);

    if (this.scriptQueue.length == 0)
    {
      this.loadedParts[name] = true;

      if (callback) {
        self ? callback.call(self) : callback();
      }

      return;
    }

    if (callback)
    {
      this.__getCallbacksForPart(name).push({
        callback : callback,
        self : self || null
      });
    }

    if (!this.inFlushQueue) {
      this._flushQueue();
    }
  },


  // Main method to manage part loading
  // see qx.core.Package.loadPart() for details
  loadPart : function(name, callback, self)
  {
    if (callback && !self) {
      self = window;
    }

    if (this.parts[name]==null)
    {
      if (callback) {
        callback.call(self);
      }

      return;
    }

    if (this.loadedParts[name])
    {
      if (callback) {
        callback.call(self);
      }

      return;
    }

    if (this.runningParts[name])
    {
      if (callback)
      {
        for (var i=0, a=this.__getCallbacksForPart(name), l=a.length; i<l; i++)
        {          
          if (a[i].callback == callback && a[i].self == self)
          {
            return;
          }
        }

        this.__getCallbacksForPart(name).push({
          callback : callback,
          self : self || null
        });
      }

      return;
    }

    this.runningParts[name] = true;

    var pkgs = this.parts[name];
    var pkg;
    var uris;
    var scripts = [];

    for (var i=0; i<pkgs.length; i++)
    {
      pkg = pkgs[i];

      if (this.loadedPackages[pkg])
      {
        continue;
      }

      if (this.runningPackages[pkg]) {
        continue;
      }

      this.runningPackages[pkg] = true;

      uris = this.uris[pkg];
      this.scriptQueue.push.apply(this.scriptQueue, uris);
    }



    if (this.scriptQueue.length == 0)
    {
      this.loadedParts[name] = true;

      if (callback) {
        self ? callback.call(self) : callback();
      }

      return;
    }

    if (callback)
    {
      this.__getCallbacksForPart(name).push({
        callback : callback,
        self : self || null
      });
    }

    if (!this.inFlushQueue) {
      this._flushQueue();
    }
  },


  _flushQueue : function()
  {
    this.inFlushQueue = true;

    var queue = this.scriptQueue;

    // Queue empty?
    if (queue.length == 0)
    {
      // Move running packages to loaded packages
      for (var pkg in this.runningPackages)
      {
        this.loadedPackages[pkg] = true;
      }
      this.runningPackages = {};
      
      // Remember the loaded parts to execute the callbacks
      var executeCallbacksForParts = [];
      
      for (var part in this.runningParts)
      {
        this.loadedParts[part] = true;
        executeCallbacksForParts.push(part);
      }
      this.runningParts = {};

      // Clear flag
      this.inFlushQueue = false;

      // Execute callbacks
      for (var i=0; i<executeCallbacksForParts.length; i++) 
      { 
        var part = executeCallbacksForParts[i];
        var callbacks = this.__getCallbacksForPart(part).concat();
        delete this.__callbacksByPartname[part];
        for (var k=0, l=callbacks.length; k<l; k++) {
          callbacks[k].callback.call(callbacks[k].self);
        }
        
        // Is this the boot module? => start init process
        if (part == this.boot && this._pageLoaded && window.qx && qx.core && qx.core.Init) {
          qx.core.Init.getInstance()._onload();
        }
      }
      
      // Finally return
      return;
    }

    // Load next script
    var next = queue.shift();

    this.loadScript(next, this._flushQueue, this);
  },

  // see qx.core.Package.loadScript() for details
  loadScript : function(uri, callback, self)
  {
    if (callback && !self) {
      self = window;
    }

    if (this.loadedScripts[uri])
    {
      if (callback) {
        callback.call(self);
      }

      return;
    }

    // This needs a better implementation!
    if (this.runningScripts[uri]) {
      throw new Error("Script is already loading.");
    }

    this.runningScripts[uri] = true;

    var head = document.getElementsByTagName("head")[0];
    var elem = document.createElement("script");

    elem.charset = "utf-8";
    elem.src = uri;

    // Assign listener
    elem.onreadystatechange = elem.onload = function()
    {
      if (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")
      {
        // Remove listeners (mem leak prevention)
        elem.onreadystatechange = elem.onload = null;

        // Remember
        delete qxloader.runningScripts[uri];
        qxloader.loadedScripts[uri] = true;

        // Execute callback
        if (callback) {
          callback.call(self);
        }
      }
    };

    head.appendChild(elem);
  },


  _pageLoad : function()
  {
    qxloader._pageLoaded = true;

    if (window.addEventListener) {
      window.removeEventListener("load", qxloader._pageLoad, false);
    } else {
      window.detachEvent("onload", qxloader._pageLoad);
    }
  },

  /**
   * Returns the array holding callbacks interested in events for part with given name.
   * Array may be modified and is guaranteed not be null (if unknown / new part name
   * is given, an empty array will be created and returned).
   * 
   * @param {String} part name
   * @return {Map[]} array of callback descriptor structures 
   * 
   */
  __getCallbacksForPart : function(partName)   
  {
    var array = this.__callbacksByPartname[partName];
    if (array == null){
      array = [];
      this.__callbacksByPartname[partName] = array;
    }
    return array;
  },


  init : function() {
    this.loadPart(this.boot);
  }
};

if (window.addEventListener) {
  window.addEventListener("load", qxloader._pageLoad, false);
} else {
  window.attachEvent("onload", qxloader._pageLoad);
}

qxloader.init();
