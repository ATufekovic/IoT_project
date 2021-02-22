# IoT_project
Napravili Robert Dumančić, Anto Tufeković

# Kako pokrenuti
Potrebno je skinuti RedHat openjdk i Apache Cassandru

Postaviti system variable JAVA_HOME na raspakirani Redhat folder i CASSANDRA_HOME na raspakirani Cassandra folder

https://phoenixnap.com/kb/install-cassandra-on-windows

Sustav se pokreće dvoklikom na bin/cassandra.bat

Za pokretanje shell-a pokreće se naredba "bin/cqlsh.bat -u cassandra -p cassandra"

Te u tom shellu je potrebno napraviti korisnika IoTuser sa istoimenom šifrom koja se po želji može postaviti u bilošta.

Nakon toga je potrebno instalirati Node.js za windows sustav.

Pokretanjem naredbe "node home.js" pokreće se poslužitelj, radi na portu 8081 ali se po potrebi može promijeniti na bilokoji odgovarajući port.

Potrebno je za pravilan rad sustava taj port otvoriti na vatrozidu i na modemu ako na njemu postoji dodatan vatrozid.

Web stranica se može povuci koristenjem IP adrese poslužitelja sa portom i "/html" poveznicom, tipa "http://192.168.1.2:8081/html"

Korisnik se registrira pa ulogira, te prima svoj userid

userid se umeće u arduino kod i postavlja ga na Croduino zajedno sa podatcima potrebnim za WiFi mrežu i IP/PORT poslužitelja

Uređaj šalje na serial port debug informacije pa se može tako pratiti aktivnost u slučaju grešaka
