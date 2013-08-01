# Developer walkthrough

## Motivation

Back when I joined Mozilla two months ago, I was given a simple task for getting up to speed with the team and the procedures: take one of my already existing Android apps, and build something similar, but using only Web technologies. I wasn't sure about what to do, but when I heard that WebRTC had just been implemented in Firefox Nightly, it was all obvious to me: I'd build a realtime-effects camera app, sort of similar to my [Nerdstalgia](http://5013.es/p/7/) app, but _doing it right_ this time: implementing all the image processing with WebGL, instead of manipulating individual pixels in a canvas.

## First prototype

I quickly hacked together a prototype that would use the webcam to capture processed frames with filtered images and make an animated GIF with them on my first week, and all that between meeting thousands (well, maybe just some _dozens_) of people, going through IT procedures and last but not least, fighting the jet-lag, as I was on Mountain View-- a -8h difference from my usual London zone. Still, the JavaScript platform makes things so easy that you can get something done even in these adverse circumstances.

Back when I developed for Android, deploying was specially slow. I had to physically connect each testing device to the computer, then deploy. With JavaScript, the only thing you do is upload files to a website, then access the website with the phone's browser. Changed something? No problem, just hit _Reload_. Debugging is the same story, specially for layout. Live editing a website by bringing up the Developer Tools and changing properties on the fly provides incredibly valuable instant feedback, accelerating the whole development cycle (and making for happier, more creative engineers, must I add).

For generating the GIF images, I used the same code from my [animated_gif.js](http://lab.soledadpenades.com/js/animated_gif/) experiment for April's Fools 2012. But there was an issue: it blocked while encoding the actual GIF. That might have been acceptable back then, but now that Web Workers are common, we shouldn't continue doing it anymore. So I started modifying the code to make use of Web Workers for encoding.

Of course, right when I was almost done, [Potch](http://potch.me/) alerted me that a new library called [gif.js](https://github.com/jnordberg/gif.js) had just been released. Right! I tried using it, but it didn't work for me. I tried fixing it, but it was written in CoffeeScript, which I'm not familiar with... so I kept working on my library, and I finally not only got Web Workers working, but also replaced the encoder part with [omggif](https://github.com/deanm/omggif), which was faster and smaller. I also fixed a rounding bug in the color quantizer that seemed to be affecting gif.js too. This bug made the output look slighly awful when the original image had many colours. The reason for this is that the GIF files commonly accept a maximum of 256 colours, but the input are images of 16 millions of possible colours. So something called a _color quantizer_ is used to find the most representative colours in the source image, and create a palette with those. Therefore, if this steps goes awry, the output image looks _weird_.

They always say that an image is worth one thousand words, so imagine we take this sample picture:

![original picture](original.jpg) _(by [petehogan](http://www.flickr.com/photos/petehogan/2687824939/))_

A proper quantizer would give us this image:

![properly quantized picture](good_quantizer.gif)

But a broken one would output this:

![badly quantized picture](bad_quantizer.gif)

Not that it doesn't look attractive in its own special way (I personally like it), but it's not what we're aiming for.

## Make it into an app

The prototype was getting better. But it was still very far away from feeling like an app. It was a website that could make a GIF using video from your webcam and then trigger a download by using the [download](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download) attribute in an A element created on the fly for that very purpose. That is _neat_ by itself (as you don't need to mingle with server side processing, or Content-Type headers, etc), but still, doesn't make it into an app.

So... what makes an app, an app? Probably some sense of containing/controlling its own data. This called for having an in-app gallery, where images could be stored away as we captured them, and viewed later on. Of course, that led us to two unavoidable matters: persistent storage in the browser, and having a proper UI.

### Storage

As we would be storing potentially large images (encoded as base64 strings), we couldn't use cookies. An alternative could have been [localStorage](https://developer.mozilla.org/en-US/docs/Web/Guide/DOM/Storage), but that is limited in size, and is also a blocking API. So what else is left? The answer was [IndexedDB](https://developer.mozilla.org/en-US/docs/IndexedDB), which allows to store data on the browser, just like ```localStorage```, but in a nicer, asynchronous way. So, again, it won't block the whole thread while saving an image, keeping the app responsive all the time.

However, the ```asyncStorage``` API is slightly more involved than ```localStorage```'s. Not willing to reinvent the wheel, I ended up using [asyncStorage.js](../js/libs/asyncStorage), a class taken from the Firefox OS source code.

I could have invoked ```asyncStorage``` directly from the gallery view code, but that would have meant that if I decided to change the storage layer, I would have to change the gallery code. That is definitely not a good sign.

To avoid that code coupling, I wrapped all the storage and semantics related to pictures into the [Picture.js](../js/Picture.js) module. This one deals with saving pictures, hides all this in a closure so that external code doesn't need to even know how this is implemented, and also exposes a ```Picture``` class that provides meaningful properties and functions for each picture instance (such as id, type) and a few 'static' methods for getting all the pictures, deleting them or getting an specific one by id.

### Building an UI

I'll admit it: building an UI toolkit doesn't sound like the most exciting plan to me. I just want to use something that works, in a meaningful and hopefully not verbose way. However, most of the existing UI toolkits are too complicated, or too procedural. Then you end up with a tangle of spaghetti HTML and JavaScript code that somehow ends up building the UI. But as soon as your app is slightly complicated, the tangle is hard to take over or understand a couple of months later: not what you want in an open source app.

Lucky as I could be, my colleagues [Arron](https://github.com/pennyfx/) and [Daniel](http://www.backalleycoder.com/) have been working on [X-Tag](http://www.x-tags.org/), a little polyfill that allows you to use Web Components --a new and upcoming Web standard for defining your own HTML tags with JavaScript, and using them declaratively in your mark-up-- *today*.

So you can define the whole structure of your app in HTML, _including_ custom UI components. That sounded like the answer to my woes. There already was [a set of available components](http://registry.x-tags.org/) built upon the [x-tag core](https://github.com/x-tag/core), but with the help of Potch and our talented intern [Leon](https://github.com/ldoubleuz) we got some more new components that I also used. At the end [the result](../index.html) is very simple, yet effective, thanks to the expressiveness that custom components allow for, without having to tangle with a mess of "divs with classes".

### Web Activities

When I finally got hold of a Firefox OS developer phone, I found that file inputs (```i.e. input type=file```) were not implemented in that particular version of Firefox OS (1.0.1). I could have flashed the phone with a newer version of the system, but considering that most of the consumer phones are running 1.0.1 currently, I wouldn't be running a similar environment to the one customers would. I think it's important to keep this in mind when you develop for mobile: you can't just flash away and forget, as that will leave users away from your app. You should at least try to degrade gracefully.

In this case, the situation was hinting heavily towards using [Web Activities](https://developer.mozilla.org/en-US/docs/WebAPI/Web_Activities). In case you don't know what a Web Activity is, it's basically a way for Firefox OS applications to interoperate between them, allowing an app to use some part of another app in a nice and decoupled way. A classic example could be the Gallery app exposing its _view_ activity, so if you want to display an image in the device but don't want to code a viewer, you can simply launch an activity with ```type = 'view'```, and the system will display a list of applications that can handle that type of activities, and allow the user to select which one she wants to use, if there is more than one registered app for this activity type. If you have done any Android programming, you might already know this concept as [intents](https://developer.android.com/reference/android/content/Intent.html).

Therefore, I added support for Web Activities if present--which at the time of writing this, means just Firefox OS environments. Otherwise, it just shows up a normal file picker. You can do it in your app too:

```javascript
if(window.MozActivity) {
    var activity = new MozActivity({
        name: 'pick',
        data: {
            type: 'image/jpeg'
        }
    });

    activity.onsuccess = function() {
        var picture = this.result;
        var blob = picture.blob; // this is just a standard blob
    }

    activity.onerror = function() {
        // oh no!
    }
} else {
    var input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('changed', function() {
        // this.files contains a list of blobs corresponding to the selected files
        if(this.files.length > 0) {
            // Accessing the first file
            var blob = this.files[0];
        }
    }, false);
    document.body.appendChild(input);
}
```

In both cases you get [blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)s that you can manipulate just like any other blob.

### Sharing

No app is complete nowadays without some way of _sharing_. We were already providing for a rudimentary way of sharing: you could save the images "out" of the gallery, and do whatever you wanted with them, such as send them by email. But that meant you had to escape away from our fastuous app, and you don't want that, right? The very brilliant [Fred Wenzel](http://fredericiana.com/) suggested [imgur](http://imgur.com/) as a developer friendly image sharing service. Actually, there was [a post](https://hacks.mozilla.org/2011/03/the-shortest-image-uploader-ever/) by Paul Rouget on how to use the imgur API with JavaScript, but it referred to an old version of the API. I made it to work with the new one. There wasn't much of a difference, other than the required payload that you have to set in a header before sending the actual request data:

```javascript
xhr.setRequestHeader('Authorization', 'Client-ID ' + IMGUR_KEY);
```


### AppCache is your friend. No, it really is.

After an embarrassing situation where I enthusiastically tried to show the app on my mobile phone to some friends while not having data connection, and the app failed miserably because the code wasn't cached, I fought back by implementing [AppCache](https://developer.mozilla.org/en-US/docs/HTML/Using_the_application_cache).

All it takes is a little bit of care, and the results are very nice. And it is really well suited for this sort of apps where most of the files will rarely change. There are tools to generate the manifest.appcache file, but I just whipped out some unix command line magic:

```bash
find . -type f  | grep -v manifest.appcache | grep -v .DS_Store | grep -v .git/ | grep -v .gitignore | grep -v docs | grep -v README.md | sed 's/^\.\///g' > manifest.appcache
```

To test I was generating the file properly, I needed to completely erase the cached entries quite often. I used the *appcache* console commands described in [The Application Cache is no longer a Douchebag](http://flailingmonkey.com/application-cache-not-a-douchebag) in Firefox, and the [AppCache internals](chrome://appcache-internals/) page for Chrome (that last link will probably not work in other browsers!)


## Fallbacks and graceful degradation

### WebRTC

Sadly, sometimes the cutting-edge technologies won't work for people who prefer stable and proven technologies. Ah, if everyone was on Nightly! But that is not the case. Thus, we need to make sure that the new and nifty features are available before using them. If they are, *great*. If they are not, then we should try to either degrade, or hide things so that the app not only does not break, but still makes sense.

For our particular case, there were two fundamental technologies without which the app can't work: WebGL and WebRTC. WebGL is already present in Firefox OS, which is incredibly great, but here's the downside: WebRTC is not available there _yet_, so we can't get a live camera stream. But we figured out that you could still use the app in that case, by picking existing images to process them _with_ WebGL. Granted, it's not the same funny and exciting experience as processing images in real time, but it still provides value to the user.

I factored the code that dealt with the webcam into a file funnily called [gumHelper.js](../js/gumHelper.js). No, it doesn't have anything to do with gums or keeping your teeth healthy; it stands for _getUserMediaHelper_, where ```getUserMedia``` is the part of WebRTC that allows us to access the computer's webcam (with the user's permission, of course). This little class tries to be a bit smart and compensate for shortcomings in some implementations, besides also providing us with a unified, unprefixed way to access the webcam. Thus, I used it to detect if ```getUserMedia``` support was present. If it is, the _Camera_ button is shown. Otherwise, it remains hidden. A simplified workflow that checks for support and then starts streaming could look like this:

```javascript
if(navigator.getMedia) {

    gumHelper.startVideoStreaming(function errorCallback() {

        window.alert('Oh oh, something failed');

    }, function successCallback(stream, videoElement, width, height) {

        videoContainer.appendChild(videoElement);
        buttonStart.disabled = true;
        buttonStop.disabled = false;

    });

} else {

    window.alert('For some reason it looks like your browser does not support getUserMedia');

}
```

(taken from the [gumHelper](https://github.com/sole/gumhelper/blob/master/demo/demo.js) demo)

In fact, it was the other way round initially: the button was shown first, and hidden if the functionality was not available, but this sometimes could produce an undesirable "flashing" effect where the button was there for a brief moment of time, and then hidden as the gUM support was discovered to be missing. That's quite disconcerting for users, and you don't want to disconcert anyone.

### Be green, be nice to everyone

You don't want to fry battery-powered devices. This does not only include mobile devices, but also laptops --while disconnected from mains. Of course, we should try to avoid consuming unneccessary energy in all sorts of devices, but it's hard to avoid devouring quite a bit of power when doing realtime image processing. Still, we can try to make it as efficient as possible. There are several strategies for this, which I'll detail in the following points.

#### requestAnimationFrame

It is another of [our old friends](https://developer.mozilla.org/en-US/docs/Web/API/window.requestAnimationFrame), and he never gets old.

#### Be lazy

Don't redraw or process a video frame until you've got enough data for a new frame. This can be detected with the following:

```javascript
if(video.readyState === video.HAVE_ENOUGH_DATA) {
    // ready to update
}

```

Also, it pays to be intelligently lazy too: since we can't capture another short clip while we're still rendering the current one, why not disable image processing in the meantime? That helps quicken rendering, and also will save some few milliwatts. Once the rendering is done, we can resume the live processing.

#### Animated GIFs are expensive to render

I found that the gallery view performance went downhill when many animated gifs were shown at the same time. That's because each time a new frame has to be displayed, the element gets invalidated and marked as "dirty" in the DOM tree, and thus its parent needs to redraw that area, etc.

There are better solutions, but for now I am just listening to the window ```scroll``` event and when the pictures get out of the viewport, I set their visibility to ```hidden```. Likewise, they are set to ```visible``` when they are about to be in the viewport, by using a little margin. See the code of [GalleryView.js](../js/GalleryView.js) for details.

#### Be minimal

Keeping in line with our goal of being nice to less powerful devices, I avoided as much as possible the use of big libraries. This slightly scared me initially, as I was quite used to rely on [Three.js](http://threejs.org) for all my WebGL needs, but as they say, you don't learn if you don't get out of your comfort zone.

So I rolled up my sleeves and whipped out something that would use almost raw WebGL. Since I had experience with OpenGL and OpenGL ES, it wasn't too complicated, just a little bit tedious, because Three.js abstracts all the concepts in a very nice and friendly manner. In exchange, I got a minimal [Renderer](../js/Renderer.js) that sets up a WebGL context, loads a series of ImageEffects containing shaders, accepts any HTML element as input, and draws it into a rectangle using the active effect. That's all it does. No Scene Graphs, nor Geometry abstractions, or anything else. It's intentionally limited in nature, because we don't need anything else for this app.

## The future

We have tried to make this app as clear, self-explanatory and/or commented as possible, so that people can not only have fun with it, but also learn, hack and contribute to it.

Adding a new effect is as simple as creating two shader files and adding a line to the Renderer's list of effect definitions. And most of the times you can just start with an existing shader that you like, and modify it to see what happens. Also, [GLSL Sandbox](http://glsl.heroku.com/) and [Shader Toy](https://www.shadertoy.com/) are another two great places to get _glInspiration_!

Something else I've been doing (and haven't even finished yet) is extracting parts from the app and making them into reusable components. So far [Animated_GIF](https://github.com/sole/Animated_GIF) and [gumHelper](https://github.com/sole/gumhelper) have been _promoted_ to modules.
