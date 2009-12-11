#!/usr/bin/python

# Copyright (c) 2009, Eric Fredricksen <e@fredricksen.net>
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
# ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
# ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
# OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

""" Run the server named herein or on command line, using node.
Whenever it changes, kill and restart. (See http://nodejs.org/)

This is useful during editing and testing of the server."""


import os, sys, time, signal

root = (sys.argv[1:] or ['.'])[0]
filenames = ["woses.js"];
conf = os.path.join(root, ".woses-conf.js");
if os.path.exists(conf): filenames.append(conf);

def restart(pid):
  if pid:
    os.kill(pid, signal.SIGTERM)
  pid = os.spawnlp(os.P_NOWAIT, "node", "node", "woses.js", root);
  print "Started", pid
  return pid

os.system("killall -v node");

pid = None
mtime = []
while True:
  m = [os.stat(filename).st_mtime for filename in filenames]
  if mtime != m:
    pid = restart(pid)
    mtime = m
  else:
    try:
      os.kill(pid, 0)
    except:
      pid = restart(pid)
    
  try:
    time.sleep(1)
  except KeyboardInterrupt:
    print "\nKilling", pid, "^C again to quit"
    if pid:
      os.kill(pid, signal.SIGTERM)
      pid = None
    try:
      time.sleep(1)
    except KeyboardInterrupt:
      print
      break
