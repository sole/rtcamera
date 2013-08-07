# rtcamera

A fun camera app to process images in real time, using Web technologies. [Check it out!](http://sole.github.io/rtcamera)

*Warning: the online version might be slightly outdated as I only push "stable" code there. Check out the latest code if you want to play with the latest features*

## Requirements

You need a browser with support for WebRTC's getUserMedia and WebGL, and a connected camera for maximum fun.

Firefox for desktop has ```getUserMedia``` enabled by default starting on Firefox 22. If you want to run this on your Android device, you'll need to get a (Nightly](http://nightly.mozilla.org/) or [Aurora](http://aurora.mozilla.org) version.

On Firefox OS, WebRTC support is not ready yet, so the live image processing feature is not available, but you can still pick existing images, modify them and save the ones you like.

Chrome should work out of the box on desktop, but WebRTC is not supported on the stable Chrome Mobile yet. You have to use Chrome Mobile Beta, and also go to ```chrome://flags``` and enable WebGL.

## How to run it

Get the code by cloning it:

```git clone git@github.com:sole/rtcamera.git rtcamera```

Then, because we load files using AJAX, you'll need to either upload a copy to your server, or use a local server.

If you're running Linux or Mac OS you will probably be able to start a local server by running this:

```bash
cd rtcamera
python -m SimpleHTTPServer
```

The app will be accessible at ```http://localhost:8000/```

You will need to find out your computer's IP address if you want to try it on your mobile device. Once you know the address, replace ```localhost``` with it and try that on your device. For example, assuming the address is 192.168.0.10, you'd browse to ```http://192.168.0.10:8000``` on your device.

A [developer walkthrough](./docs/Walkthrough.md) is also available.

## Bugs

We're using the mighty Bugzilla for filing bugs on this project.
Please add them under [Developer Ecosystem :: App Center](https://bugzilla.mozilla.org/enter_bug.cgi?product=Developer%20Ecosystem&component=App%20Center), and for maximum helpfulness, you can also add ```[refapps][rtcamera]``` to the summary line.

You can also see [the current list of bugs](https://bugzilla.mozilla.org/buglist.cgi?quicksearch=[refapps][rtcamera]&list_id=7428025), and maybe contribute to the project by taking over one of them? :-)

## Contributors

* [Soledad Penadés](http://soledadpenades.com)
* [Aaron Druck](http://www.whatthedruck.com/)

## Used libraries

This app wouldn't be possible without these wonderful libraries. Many thanks to their authors!

* [Animated_GIF](https://github.com/sole/Animated_GIF)
* [asyncStorage.js](https://github.com/mozilla-b2g/gaia/blob/master/shared/js/async_storage.js)
* [glMatrix](http://glmatrix.net/)
* [Hammer.js](http://eightmedia.github.io/hammer.js/)
* [require.js](http://requirejs.org/)
* [x-tag](http://x-tags.org/) and a bunch of [tags from Mozilla Brick](https://github.com/mozilla/brick)

## Thanks

* [Jen Fong](http://ednapiranha.com/) - for the myriad code reviews on Monday!
* [Fred Wenzel](http://fredericiana.com/) - so many good ideas and discussions!
* [tofumatt](http://lonelyvegan.com/), [potch](http://potch.me/), [Francisco Jordano](http://www.ardeenelinfierno.com/) and [Myk Melez](http://www.mykzilla.org/) - for all the work and help on the Firefox OS simulator, Gaia and answering all my questions!
