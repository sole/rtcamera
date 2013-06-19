(function(){

  var oldiOS = /OS [1-4]_\d like Mac OS X/i.test(navigator.userAgent),
    oldDroid = /Android 2.\d.+AppleWebKit/.test(navigator.userAgent),
    gingerbread = /Android 2\.3.+AppleWebKit/.test(navigator.userAgent);

  if(oldDroid){
    //<meta name="viewport" content="width=device-width; initial-scale=1.0; maximum-scale=1.0; minimum-scale=1.0; user-scalable=0;" />
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width; initial-scale=1.0; maximum-scale=1.0; minimum-scale=1.0; user-scalable=0;';
    document.head.appendChild(meta);
  }

  window.addEventListener('keyup', function(event){
    if(event.keyCode == 27) xtag.query(document, 'x-modal[esc-hide]').forEach(function(modal){
      if (modal.getAttribute('hidden') === null) xtag.fireEvent(modal, 'modalhide');
    });
  });

  if (oldiOS || oldDroid) {
    window.addEventListener('scroll', function(event){
      var modals = xtag.query(document, 'body > x-modal');
      modals.forEach(function(m){
        m.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';
      });
    });
  }

  xtag.register('x-modal', {
    mixins: ['request'],
    lifecycle: {
      created: function() {
        this.setAttribute('tabindex',0);
      },
      inserted: function() {
        if (oldiOS || oldDroid) {
          this.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';
        }
      }
    },
    events: {
      'modalhide': function() {
        this.setAttribute('hidden', '');
      }
    },
    methods: {
      toggle: function() {
        if (this.hasAttribute('hidden')) {
          this.removeAttribute('hidden');
        } else {
          this.setAttribute('hidden','');
        }
      }
    }
  });

})();
