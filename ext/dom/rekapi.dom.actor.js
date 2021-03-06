rekapiModules.push(function (context) {

  'use strict';

  var Kapi = context.Kapi;
  var _ = Kapi._;
  var vendorTransforms = [
    'transform'
    ,'webkitTransform'
    ,'MozTransform'
    ,'oTransform'
    ,'msTransform'];
  var transformFunctions = [
    'translateX',
    'translateY',
    'scale',
    'scaleX',
    'scaleY',
    'rotate',
    'skewX',
    'skewY'];


  function setStyle (forElement, styleName, styleValue) {
    forElement.style[styleName] = styleValue;
  }


  /*!
   * @param {string} name A transform function name
   * @return {boolean}
   */
  function isTransformFunction (name) {
    return _.contains(transformFunctions, name);
  }


  /*!
   * Builds a concatenated string of given transform property values in order.
   *
   * @param {Array.<string>} orderedFunctions Array of ordered transform
   *     function names
   * @param {Object} transformProperties Transform properties to build together
   * @return {string}
   */
  function buildTransformValue (orderedFunctions, transformProperties) {
    var transformComponents = [];

    _.each(orderedFunctions, function(functionName) {
      if (transformProperties[functionName]) {
        transformComponents.push(functionName + '(' +
          transformProperties[functionName] + ')');
      }
    });

    return transformComponents.join(' ');
  }


  /*!
   * Sets value for all vendor prefixed transform properties on a given context
   *
   * @param {Object} context The actor's DOM context
   * @param {string} transformValue The transform style value
   */
  function setTransformStyles (context, transformValue) {
    _.each(vendorTransforms, function(prefixedTransform) {
      setStyle(context, prefixedTransform, transformValue);
    });
  }


  /**
   * `Kapi.DOMActor` is a subclass of [`Kapi.Actor`](../../src/rekapi.actor.js.html).  Please note that `Kapi.DOMActor` accepts `opt_config` as the second parameter, not the first.  Instantiate a `Kapi.DOMActor` with an `HTMLElement`, and then add it to the animation:
   *
   * ```
   * var kapi = new Kapi();
   * var actor = new Kapi.DOMActor(document.getElementById('actor'));
   *
   * kapi.addActor(actor);
   * ```
   *
   * Now you can keyframe `actor` like you would any Actor.
   *
   * ```
   * actor
   *   .keyframe(0, {
   *     'left': '0px'
   *     ,'top': '0px'
   *   })
   *   .keyframe(1500, {
   *     'left': '200px'
   *     ,'top': '200px'
   *   }, 'easeOutExpo');
   *
   * kapi.play();
   * ```
   *
   * ## Transforms
   *
   * `Kapi.DOMActor` supports CSS3 transforms as keyframe properties. Here's an example:
   *
   * ```
   * actor
   *   .keyframe(0, {
   *     'translateX': '0px'
   *     ,'translateY': '0px'
   *     ,'rotate': '0deg'
   *   })
   *   .keyframe(1500, {
   *     'translateX': '200px'
   *     ,'translateY': '200px'
   *     ,'rotate': '90deg'
   *   }, 'easeOutExpo');
   * ```
   *
   * The list of supported transforms is: `translateX`, `translateY`, `scale`, `scaleX`, `scaleY`, `rotate`, `skewX`, `skewY`.
   *
   * Internally, this builds a CSS3 `transform` rule that gets applied to the `Kapi.DOMActor`'s DOM node on each animation update.
   *
   * Typically, when writing a `transform` rule, it is necessary to write the same rule multiple times, in order to support the vendor prefixes for all of the browser rendering engines. `Kapi.DOMActor` takes care of the cross browser inconsistencies for you.
   *
   * You can also use the `transform` property directly:
   *
   * ```
   * actor
   *   .keyframe(0, {
   *     'transform': 'translateX(0px) translateY(0px) rotate(0deg)'
   *   })
   *   .keyframe(1500, {
   *     'transform': 'translateX(200px) translateY(200px) rotate(90deg)'
   *   }, 'easeOutExpo');
   * ```
   * @param {HTMLElement} element
   * @param {Object} opt_config
   * @constructor
   */
  Kapi.DOMActor = function (element, opt_config) {
    Kapi.Actor.call(this, opt_config);
    this._context = element;
    var className = this.getCSSName();

    // Add the class if it's not already there.
    // Using className instead of classList to make IE happy.
    if (!this._context.className.match(className)) {
      this._context.className += ' ' + className;
    }

    this._transformOrder = transformFunctions.slice(0);

    // Remove the instance's update method to allow the DOMActor.prototype
    // methods to be accessible.
    delete this.update;
    delete this.teardown;

    return this;
  };
  var DOMActor = Kapi.DOMActor;


  function DOMActorMethods () {}
  DOMActorMethods.prototype = Kapi.Actor.prototype;
  DOMActor.prototype = new DOMActorMethods();


  /*!
   * @param {HTMLElement} context
   * @param {Object} state
   * @override
   */
  DOMActor.prototype.update = function (context, state) {
    var propertyNames = _.keys(state);
    // TODO:  Optimize the following code so that propertyNames is not looped
    // over twice.
    var transformFunctionNames = _.filter(propertyNames, isTransformFunction);
    var otherPropertyNames = _.reject(propertyNames, isTransformFunction);
    var otherProperties = _.pick(state, otherPropertyNames);

    if (transformFunctionNames.length) {
      var transformProperties = _.pick(state, transformFunctionNames);
      var builtStyle = buildTransformValue(this._transformOrder,
          transformProperties);
      setTransformStyles(context, builtStyle);
    } else if (state.transform) {
      setTransformStyles(context, state.transform);
    }

    _.each(otherProperties, function (styleValue, styleName) {
      setStyle(context, styleName, styleValue);
    }, this);
  };


  /*!
   * transform properties like translate3d and rotate3d break the cardinality
   * of multi-ease easing strings, because the "3" gets treated like a
   * tweenable value.  Transform "3d(" to "__THREED__" to prevent this, and
   * transform it back in _afterKeyframePropertyInterpolate.
   *
   * @param {Kapi.KeyframeProperty} keyframeProperty
   * @override
   */
  DOMActor.prototype._beforeKeyframePropertyInterpolate =
      function (keyframeProperty) {
    if (keyframeProperty.name !== 'transform') {
      return;
    }

    var value = keyframeProperty.value;
    var nextProp = keyframeProperty.nextProperty;

    if (nextProp && value.match(/3d\(/g)) {
      keyframeProperty.value = value.replace(/3d\(/g, '__THREED__');
      nextProp.value = nextProp.value.replace(/3d\(/g, '__THREED__');
    }
  };


  /*!
   * @param {Kapi.KeyframeProperty} keyframeProperty
   * @param {Object} interpolatedObject
   * @override
   */
  DOMActor.prototype._afterKeyframePropertyInterpolate =
      function (keyframeProperty, interpolatedObject) {
    if (keyframeProperty.name !== 'transform') {
      return;
    }

    var value = keyframeProperty.value;
    var nextProp = keyframeProperty.nextProperty;

    if (nextProp && value.match(/__THREED__/g)) {
      keyframeProperty.value = value.replace(/__THREED__/g, '3d(');
      nextProp.value = nextProp.value.replace(/__THREED__/g, '3d(');
      var keyPropName = keyframeProperty.name;
      interpolatedObject[keyPropName] =
          interpolatedObject[keyPropName].replace(/__THREED__/g, '3d(');
    }
  };


  // TODO:  Make this a private method.
  DOMActor.prototype.teardown = function (context, state) {
    var classList = this._context.className.match(/\S+/g);
    var sanitizedClassList = _.without(classList, this.getCSSName());
    this._context.className = sanitizedClassList;
  };


  /**
   * This can be useful when used with [toCSS](../to-css/rekapi.to-css.js.html).  You might not ever need to use this directly, as the class is attached to an element when you create a `Kapi.DOMActor` from said element.
   * @return {string}
   */
  DOMActor.prototype.getCSSName = function () {
    return 'actor-' + this.id;
  };


  /**
   * Overrides the default transform function order.
   *
   * @param {Array} orderedFunctions The Array of transform function names
   * @return {Kapi.DOMActor}
   */
  DOMActor.prototype.setTransformOrder = function (orderedFunctions) {
    // TODO: Document this better...
    var unknownFunctions = _.reject(orderedFunctions, isTransformFunction);

    if (unknownFunctions.length) {
      throw 'Unknown or unsupported transform functions: ' +
        unknownFunctions.join(', ');
    }
    // Ignore duplicate transform function names in the array
    this._transformOrder = _.uniq(orderedFunctions);

    return this;
  };

});
