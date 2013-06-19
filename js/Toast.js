var Toast = function(text) {

    var div;
    
    function hide() {
        div.classList.add('hidden');
    }

    function onTransitionEnd() {
        document.body.removeChild(div);
    }

    this.show = function(duration) {

        duration = duration || 1500;

        div = document.createElement('div');
        div.innerHTML = '<span>' + text + '</span>';
        div.className = 'toast';

        div.addEventListener('transitionend', onTransitionEnd, false);
        div.addEventListener('webkitTransitionEnd', onTransitionEnd, false);

        document.body.appendChild(div);

        setTimeout(hide, duration);

    };
};
