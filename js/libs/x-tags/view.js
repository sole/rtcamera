(function(){
  
  function getViewElements(view){
    var first = view.firstElementChild;
    return {
      header: first && first.nodeName == 'HEADER' ? first : null,
      section: first && first.nodeName == 'SECTION' ? first : first && first.nextElementSibling && first.nextElementSibling.nodeName == 'SECTION' ? first.nextElementSibling : null,
      footer: view.lastElementChild.nodeName == 'FOOTER' ? view.lastElementChild : null
    };
  }
  
  xtag.register('x-view', {
    lifecycle: {
      created: function(){
        
      }
    },
    methods: {
      foo: function(){
        
      }
    },
    events:{
      transitionend: function(e){
        if (!this.hasAttribute('maxcontent') && e.propertyName == 'height') {
          if (this.firstElementChild.nodeName == 'HEADER') {
            this.firstElementChild.style.height = '';
          }
          if (this.lastElementChild.nodeName == 'FOOTER') {
            this.lastElementChild.style.height = '';
          }
        }
      }
    },
    accessors: {
      maxcontent: {
        attribute: { boolean: true },
        set: function(){
          var view = this;
          if (this.hasAttribute('maxcontent')) {
            xtag.skipTransition(this, function(){
              var elements = getViewElements(view);
              if (elements.header) elements.header.style.height = elements.header.getBoundingClientRect().height + 'px';
              if (elements.footer) elements.footer.style.height = elements.footer.getBoundingClientRect().height + 'px';
              
              return function(){
                if (elements.header) elements.header.style.height = '0px';
                if (elements.footer) elements.footer.style.height = '0px';
              };
            });
          }
          else {
            var elements = getViewElements(view);
            if (elements.header) elements.header.style.height = elements.header.scrollHeight + 'px';
            if (elements.footer) elements.footer.style.height = elements.footer.scrollHeight + 'px';
          }
        }
      }
    }
  });

})();