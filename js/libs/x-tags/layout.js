(function(){
  
  function getLayoutElements(layout){
    var first = layout.firstElementChild;   
    if (!first) return { header: null, section: null, footer: null };
    var second = first.nextElementSibling;
    return {
      header: first.nodeName == 'HEADER' ? first : null,
      section: first.nodeName == 'SECTION' ? first : second && second.nodeName == 'SECTION' ? second : null,
      footer: layout.lastElementChild.nodeName == 'FOOTER' ? layout.lastElementChild : null
    };
  }
  
  function getLayoutScroll(layout, element){
    var scroll = element.__layoutScroll__ = element.__layoutScroll__ || Object.defineProperty(element, '__layoutScroll__', {
      value: {
        last: element.scrollTop
      }
    }).__layoutScroll__;
    var now = element.scrollTop,
        buffer = layout.scrollBuffer;
    scroll.max = scroll.max || Math.max(now + buffer, buffer);
    scroll.min = scroll.min || Math.max(now - buffer, buffer);
    return scroll;
  }
  
  function maxContent(layout, elements){
    layout.setAttribute('content-maximizing', null);
    if (elements.header) elements.header.style.marginTop = '-' + elements.header.getBoundingClientRect().height + 'px';
    if (elements.footer) elements.footer.style.marginBottom = '-' + elements.footer.getBoundingClientRect().height + 'px';
  }
  
  function minContent(layout, elements){
    layout.removeAttribute('content-maximized');
    if (elements.header)  elements.header.style.marginTop = 0;
    if (elements.footer) elements.footer.style.marginBottom = 0;
  }
  
  function evaluateScroll(event){
    if (!event.currentTarget.hasAttribute('content-maximizing')) {
      var target = event.target,
          layout = event.currentTarget;
      
      if (this.scrollhide && (target.parentNode == layout || xtag.matchSelector(target, layout.scrollTarget))){
        var now = target.scrollTop,
            buffer = layout.scrollBuffer,
            elements = getLayoutElements(layout),
            scroll = getLayoutScroll(layout, target);
        
      //  console.log(scroll, event);
        
        if (now > scroll.last) scroll.min = Math.max(now - buffer, buffer);
        else if (now < scroll.last) scroll.max = Math.max(now + buffer, buffer);
        
        if (!layout.maxcontent) {
          if (now > scroll.max && !layout.hasAttribute('content-maximized')) maxContent(layout, elements);
          else if (now < scroll.min) minContent(layout, elements);
        }
        
        scroll.last = now;
      }
    }
  }
  
  var margin = {
    'margin-top': 'marginTop',
    'margin-bottom': 'marginBottom'
  };
  
  xtag.register('x-layout', {
    lifecycle: {
      created: function(){
        
      }
    },
    methods: {
      
    },
    events:{
      scroll: evaluateScroll,
      transitionend: function(e){
        var elements = getLayoutElements(this);
        this.removeAttribute('content-maximizing');
        if ((e.target == elements.header || e.target == elements.footer) && e.target.style[margin[e.propertyName]] == '0px') {
          this.removeAttribute('content-maximized');
        }
        else this.setAttribute('content-maximized', null);
      },
      'tap:delegate(section)': function(e){
        var layout = e.currentTarget;
        if (layout.taphide && this.parentNode == layout) {
          var elements = getLayoutElements(layout);
          if (layout.hasAttribute('content-maximizing') || layout.hasAttribute('content-maximized')) {
            if (!layout.maxcontent) minContent(layout, elements);
          }
          else maxContent(layout, elements);
        }
      },
      'mouseover:delegate(section)': function(e){
        var layout = e.currentTarget;
        if (layout.hoverhide && this.parentNode == layout && !layout.hasAttribute('content-maximized') && !layout.hasAttribute('content-maximizing') && (!e.relatedTarget || this.contains(e.target))) {
          maxContent(layout, getLayoutElements(layout));
        }
      },
      'mouseout:delegate(section)': function(e){
        var layout = e.currentTarget;
        if (layout.hoverhide && this.parentNode == layout && (layout.hasAttribute('content-maximized') || layout.hasAttribute('content-maximizing')) && (layout == e.relatedTarget || !layout.contains(e.relatedTarget))) {
          minContent(layout, getLayoutElements(layout));
        }
      }
    },
    accessors: {
      scrollTarget: {
        attribute: { name: 'scroll-target' }
      },
      scrollBuffer: {
        attribute: { name: 'scroll-buffer' },
        get: function(){
          return Number(this.getAttribute('scroll-buffer')) || 30;
        }
      },
      taphide: {
        attribute: { boolean: true }
      },
      hoverhide: {
        attribute: { boolean: true }
      },
      scrollhide: {
        attribute: { boolean: true }
      },
      maxcontent: {
        attribute: { boolean: true },
        set: function(value){
          var elements = getLayoutElements(this);
          if (value) maxContent(this, elements);
          else if (!this.hasAttribute('content-maximizing')) minContent(this, elements);
        }
      }
    }
  });

})();
