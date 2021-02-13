const http = require('http');
const cassandra = require('cassandra-driver');
const { url } = require('inspector');

const client = new cassandra.Client({
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'test',
    credentials : {username : "iotuser", password : "iotuser"}
});

const VERBOSE = true;

// userid -> uuid, date -> date("YYYY-MM-DD"), [ts -> timeuuid], deviceid -> uuid, humidity -> float, temperature -> integer
const query_POST = "INSERT INTO entries_by_userid (userid, date, ts, deviceid, humidity, temperature) VALUES (?, ?, now(), ?, ?, ?);";

const query_GET_entries = "SELECT date, ts, temperature, humidity FROM entries_by_userid WHERE userid = ? AND date = ?;";

//this has to be solved client-side, eg. after logging in get userid and also the devices have to be settable to its users id
const uuid_v4_regex = "/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i";


http.createServer(function (request, response) {
    if (request.method == "GET") {
        if(VERBOSE)
            console.log("GET " + request.url);
        let req_url = new URL(request.url, "http://" + request.headers.host);

        if(request.url == "/test" || request.url == "/"){
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.write(JSON.stringify({ "name": "some", "age": 4, "lacks": "shame" }));
            response.end();
            if(VERBOSE)
                console.log('Served GET(test)...');
        
        //rip apart request.url to get path and query parameters


        } else if(req_url.pathname == "/get_entries"){
            //TODO: fix hardcoded userid and date
            /* let date = new Date();
            let time = date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1) + "-" + date.getUTCDate();
            if(VERBOSE)
                console.log(time); */
            
            let queries = {};
            req_url.searchParams.forEach((value, key) => {
                queries[key] = value;
            });

            if(!(queries.userid.match(uuid_v4_regex))){
                response.writeHead(400, {"Content-Type":"text/html"});
                response.write("Invalid UUID");
                response.end();
                if(VERBOSE)
                    console.log("Served bad GET(UUID)...");
            }

            if(VERBOSE)
                console.log(queries);
            
            
            let rows = [];
            let params = [queries.userid, queries.date];
            client.eachRow(query_GET_entries, params, {prepare : true, autoPage : true}, (n, row) => {
                rows.push(row);
            }, ()=> {
                console.log("Number of returned rows: " + rows.length);
                response.writeHead(200, {"Content-Type" : "application/json"});
                response.write(JSON.stringify(rows));
                response.end();
                if(VERBOSE)
                    console.log("Served GET(entries)...")
            });
        }
        else {
            response.writeHead(400, {'Content-Type' : 'text/html'});
            response.write("Nothing specified...");
            response.end();
            if(VERBOSE)
                console.log("Served bad GET(not specified)...")
        }
        //---------------------------------------------------------------------------------------------------
    } else if (request.method == "POST") {
        if(VERBOSE)
            console.log("POST " + request.url);
        let body = "";
        request.on('data', (data) => {
            body += data;
            if(VERBOSE)
                console.log("Partial body: " + body);
        });
        request.on('end', () => {
            if(VERBOSE)
                console.log("Body: " + body);
            response.writeHead(200, {"Content-Type":"text/html"});
            response.end("post received");

            //prepare and send body content to cassandra

            let content;
            try {
                content = JSON.parse(body);
            } catch (error) {
                console.log(error.message);
            }
            
            if(VERBOSE){
                console.log(content.user_id);
                console.log(content.device_id);
                console.log(content.temperature);
                console.log(content.humidity);
            }

            //prepare the "date" field
            let date = new Date();
            let time = date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1) + "-" + date.getUTCDate();
            if(VERBOSE)
                console.log(time);



            let params = [content.user_id, time, content.device_id, content.humidity, content.temperature];
            client.execute(query_POST, params, {prepare : true}).then((result) => {
                if(VERBOSE)
                    console.log("Logged...");
            });

        });
    }
}).listen(8081);

console.log('Server running at http://192.168.1.2:8081/');