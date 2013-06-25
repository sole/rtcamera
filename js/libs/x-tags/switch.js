(function(){

  var template =  '<input type="hidden" />' +
  '<div>' +
    '<div class="x-switch-text" ontext="ON" offtext="OFF"></div>' +
    '<div><div class="x-switch-knob"><br/></div></div>' +
    '<div class="x-switch-knob">' +
      '<div class="x-switch-background">' +
        '<div class="x-switch-text x-switch-on" ontext="ON" offtext="OFF"></div>' +
        '<div><div class="x-switch-knob"><br/></div></div>' +
        '<div class="x-switch-text x-switch-off" ontext="ON" offtext="OFF"></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  function textSetter(state){
    return {
      attribute: { name: state + 'text' },
      get: function(){
        var attrValue = this.getAttribute(state + 'text');
        return attrValue !== null ? attrValue : state;
      },
      set: function(text){
        xtag.query(this, '[' + state + 'text]').forEach(function(el){
          el.setAttribute(state + 'text', text);
        });
      }
    };
  }

  xtag.register('x-switch', {
    lifecycle: {
      created: function(){
        this.setAttribute('tabindex', this.getAttribute('tabindex') || 0);
        this.innerHTML = template;
        this.onText = this.onText;
        this.offText = this.offText;
        this.checked = this.checked;
        this.formName = this.formName;
      }
    },
    methods: {
      toggle: function(state){
        this.checked = typeof state == 'undefined' ? (this.checked ? false : true) : state;
      }
    },
    events:{
      'tapend:preventable:delegate(div)': function(e){
        if (!e.currentTarget.disabled){
          e.currentTarget.checked = !e.currentTarget.checked;
        }
      },
      'keydown:preventable:keypass(32)': function(){
        if (!this.disabled){
          this.checked = !this.checked;
        }
      }
    },
    accessors: {
      onText: textSetter('on'),
      offText: textSetter('off'),
      checked: {
        attribute: { boolean: true },
        set: function(state){
          this.firstElementChild.value = !!state;
        }
      },
      disabled: {
        attribute: { boolean: true, selector: 'input' }
      },
      formName: {
        attribute: { name: 'formname' },
        get: function(){
          return this.firstElementChild.getAttribute('name') || this.getAttribute('formName');
        },
        set: function(value){
          this.firstElementChild.setAttribute('name', value);
        }
      }
    }
  });

})();
