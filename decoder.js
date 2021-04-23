"use strict";

// switch between "G120" or "SensorNodeBLE"
var deviceType = "G120";
//var deviceType = "SensorNodeBLE";

/*

A Datacake compatible decoder for: 

Digital Matter G120 GPS and Bluetooth Gateway
Digital Matter SensoreNode BLE

Origin: Datacake 2021 - Author: Simon Kemper

*/

// Helper Functions

function convertToSignedInt(payload) {
    var sign = payload[0] & (1 << 7);
    var x = (((payload[0] & 0xFF) << 8) | (payload[1] & 0xFF));
    if (sign) {
       x = 0xFFFF0000 | x;  // fill in most significant bits with 1's
    }		    
    return x/10;
}

function readUInt(arr, p, s) {
    var r = 0;
    for (var i = s-1; i >= 0; i--) {
        r |= arr[p + i] << (i * 8);
    } return r >>> 0;
}

// Main Decoder Function

function Decoder(request) {
    
    // first we JSONize the Payload
    var payload = JSON.parse(request.body);
    
    // we are using ICCID for serial
    var serial = payload.ICCID;
    
    // extract records
    var records = payload.Records;
    
    // storage for Datacake Forward
    var decodedG120 = {}
    var decodedTags = [];
    
    for (var recordIndex = 0; recordIndex < records.length; recordIndex++) {
        
        var record = records[recordIndex];
        var sequenceNo = record.SeqNo;
        var fields = record.Fields;
        
        for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
            
            var field = fields[fieldIndex];
            var fieldType = field.FType;
            
            if (fieldType === 0) {
               
               decodedG120.location = "(" + field.Lat + "," + field.Long + ")";
               decodedG120.altitude = field.Alt;
               decodedG120.speed = field.Spd;
               decodedG120.speed_acc = field.SpdAcc;
               decodedG120.pdop = field.PDOP;
               decodedG120.position_acc = field.PosAcc;
               decodedG120.gps_stat = field.GpsStat;
               decodedG120.heading = field.Head;
               
            } else if (fieldType === 2) {
                
                decodedG120.d_in = field.DIn;
                decodedG120.d_out = field.DOut;
                decodedG120.dev_stat = field.DevStat;
                
            } else if (fieldType === 6) {
                
                var analogData = field.AnalogueData;
                
                decodedG120.analog_ch_1 = analogData["1"];
                decodedG120.analog_ch_2 = analogData["2"];
                decodedG120.analog_ch_3 = analogData["3"];
                decodedG120.analog_ch_4 = analogData["4"];
                decodedG120.analog_ch_5 = analogData["5"];
                decodedG120.analog_ch_6 = analogData["6"];
                
            } else if (fieldType === 29) {
                
                var tags = field.Tags;
                
                for (var tagIndex = 0; tagIndex < tags.length; tagIndex++) {
                    
                    var decodedTagData = {}
                    
                    var tag = tags[tagIndex];
                    
                    var tag_type = tag.TT;
                    var tag_reason = tag.Reason;
                    var tag_rssi = tag.RSSI;
                    var data = tag.Data;
                    
                    // Decoder Tag Base64 Data into Byte-Array
                    var decodedData = __base64decode(data);

                    decodedTagData.tag_serial_number = readUInt(decodedData, 0, 4);
                    decodedTagData.tag_rssi = tag_rssi;
                    decodedTagData.tag_tx_power = decodedData[4] * 0.1;
                    decodedTagData.tag_battery_voltage = decodedData[5] * 0.05;
                    decodedTagData.tag_temperature_internal = decodedData[6];
                    decodedTagData.tag_temperature_probe_1 = convertToSignedInt(decodedData.slice(7,9)) * 0.01;
                    decodedTagData.tag_temperature_probe_2 = convertToSignedInt(decodedData.slice(9,11)) * 0.01;
                    decodedTagData.tag_temperature_rh_sensor = convertToSignedInt(decodedData.slice(11,13)) * 0.01;
                    decodedTagData.tag_humidity_rh_sensor = decodedData[13];
                    
                    /*                    
                    console.log("");
                    console.log(JSON.stringify(decodedTagData));
                    console.log("");
                    */
                    
                    decodedTags.push(decodedTagData);
                }
                
                //decoded.tags = tags;
            }
            
        }
    }

    // Choose Type
    
    function convertToDatacake(decoded, serial) {
        // Array where we store the fields that are being sent to Datacake
        var datacakeFields = []
        
        // take each field from decoded and convert them to Datacake format
        for (var key in decoded) {
            if (decoded.hasOwnProperty(key)) {           
                datacakeFields.push(
                    {
                        field: key.toUpperCase(), 
                        value: decoded[key]
                        device: serial
                    })
            }
        }      
        
        // forward data to Datacake
        return datacakeFields;        
    }

    if (deviceType === "G120") {
        
        var decoded = decodedG120;
        return convertToDatacake(decoded, serial);
        
    } else if (deviceType === "SensorNodeBLE") {
        
        tagArray = [];
        
        for (var tagIndex = 0; tagIndex < decodedTags.length; tagIndex++) {
            
            var decoded = decodedTags[tagIndex];
            tagArray = tagArray.concat(convertToDatacake(decoded, decoded.tag_serial_number));
            
        }
        
        return tagArray;
    }
    
}
