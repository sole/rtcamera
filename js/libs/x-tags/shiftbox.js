
(function(){

	xtag.register('x-shiftbox', {
		events:{
			'transitionend': function(e){
				if (e.target == xtag.queryChildren(this, 'x-content')[0]){
					if (this.shift.length){
						xtag.fireEvent(this, 'closed');
					}
					else {
						xtag.fireEvent(this, 'opened');
					}
				}
			}
		},
		accessors: {
			'shift': {
				attribute: {},
				get: function(){
					return this.getAttribute('shift') || '';
				}
			}
		},
		methods: {
			'toggle': function(){
				if (this.hasAttribute('open')){
					this.removeAttribute('open');
				} else {
					this.setAttribute('open','');
				}
			}
		}
	});

})();