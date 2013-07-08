# rtcamera

A fun camera app to process images in real time, using Web technologies. [Check it out!](http://sole.github.io/rtcamera)

*Warning: the online version might be slightly outdated as I only push "stable" code there. Check out the latest code if you want to play with the latest features*

## Requirements

You need a browser with support for WebRTC and WebGL, and a connected camera for maximum fun.

If you're running Firefox (either Desktop and Mobile) you might need to explicitly enable WebRTC. Go to about:config and set ```media.peerconnection.enabled``` to ```true```, and possibly use a Nightly build, that you can get from the [Nightly builds](http://nightly.mozilla.org/) website. **NOTE:** This is a temporary requirement, as WebRTC should get *out of beta* soon in Firefox, and you won't need to do that to run this app.

Chrome should work out of the box on desktop, but WebRTC is not supported on mobile yet.

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
