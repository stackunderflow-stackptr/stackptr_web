Setting up stackptr
###################

To setup a development environment::

.. highlight:: console

  $ virtualenv env
  $ ./env/bin/pip install -r requirements.txt

.. highlight:: ini

Then create the configuration file::

  [app]
  ; Optional -- if specified, this will allow new users to join your StackPtr instance
  ;invite_code = 
  
  ; Randomly generate this key
  secret_key = 935d2ac8259852cba8d1687d02b270d1
  
  [database]
  ; PostgreSQL
  uri = postgresql://username:password@host/database
  
  ; SQLite3
  uri = sqlite:///stackptr.db3

.. highlight:: console

Then create the database::

  $ ./env/bin/python stackptr.py db update

  $ ./env/bin/crossbar start --cbdir crossbar/

This will cause the development server to run on port 8080.


Connecting an API client
------------------------

Once you have the development server running, it will be useful to have some clients use it.

In ``stackptr_tools`` there is a test program called gpxplayer.  It can be invoked with::

  $ python -m libstackptr.gpxplayer -u http://localhost:8000 api-key-here my_gpx_track_file.gpx

This will play back your GPX track in real time.