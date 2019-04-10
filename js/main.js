(function() {

//pseudo-global variables
var attrArray = ["2010 Population", "Average Commute in Minutes", "Median Household Income", "Average Monthly Rent", "Violent Crime Rate per 100k", "Average Life Expectancy"]; //list of attributes
var expressed = attrArray[0];
var float_list = [];
var maxVal = null;

//chart frame dimensions
var chartWidth = window.innerWidth * .425,
    chartHeight = 500,
    leftPadding = 2,
    rightPadding = 2,
    topBottomPadding = 25,
    chartInnerWidth = chartWidth - rightPadding - leftPadding,
    chartInnerHeight = chartHeight - topBottomPadding,
    translate = "translate(" + 4 + "," + 0  + ")";

//create new svg container for the map
var chart = d3.select('body')
    .append('svg')
    .attr('width', chartWidth)
    .attr('height', chartHeight)
    .attr('class', 'chart');

//map frame dimensions
var width = window.innerWidth * .5,
    height = 500;

//create new svg container for the map
var map = d3.select("body")
    .append('svg')
    .attr('class', 'map')
    .attr('width', width)
    .attr('height', height);

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap() {
    //create Albers equal area conic projection centered on Colorado
	var projection = d3.geoAlbers()
		.center([-0.5,45]) 
		.rotate([105, 6])
		.scale(5500)
		.translate([width /2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, 'data/ColoradoCounties.csv') //load attributes from csv
        .defer(d3.json, 'data/ColoradoCounties.topojson') //load choropleth spatial data
        .await(callback);

    function callback(error, csvData, colorado) {
        // get max val in current csv to use as domain high value
        for (var i in csvData) {
            if (!isNaN(csvData[i][expressed])) {
                float_list.push(parseFloat(csvData[i][expressed]));
            };
        };
        maxVal = Math.max.apply(null, float_list);

        var coloradoCounties = topojson.feature(colorado, colorado.objects.Colorado).features;

            coloradoCounties = joinData(coloradoCounties, csvData);
            var colorScale = makeColorScale(csvData);
            setEnumerationUnits(coloradoCounties, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        // add dropdown
        createDropdown(csvData);

        // add max and min text
        addLegend(csvData);
     };
}; //end of setMap()   

//function to add map legend
function addLegend() {
    // create the map legend
    var legend = map.append('text')
        .attr('y', 230)
        .attr('dx', 820)
        .attr('dy', '.35em')
        .attr('class', 'legend')
        .style('fill', 'rgb(80,80,80)');
    legend.append('tspan')
        .attr('dy', 0)
        .text('Top Value: ');
    legend.append('tspan')
        .attr('dy', 40)
        .attr('dx', -100)
        .text(maxVal);
};
    
function updateLegend() {
    map.select('.legend').remove();
    addLegend();
}

//function to create coordinated bar chart
function setChart(csvData, colorScale) {
    // background of chart
    var chartBackground = chart.append('rect')
        .attr('class', 'chartBackground')
        .attr('width', chartInnerWidth)
        .attr('height', chartInnerHeight)
        .attr('transform', translate);

    //create frame for chart border
    var chartFrame = chart.append('rect')
        .attr('class', 'chartFrame')
        .attr('width', chartInnerWidth)
        .attr('height', chartInnerHeight)
        .attr('transform', translate);

    //create a text element for the chart title
    var chartTitle = chart.append('text')
        .attr('x', 200)
        .attr('y', 30)
        .attr('class', 'chartTitle')
        .text('(' + expressed + ') By Colorado County');

    var xScale = d3.scaleLinear()
        .range([leftPadding + rightPadding + 1, chartInnerWidth - 10])
        .domain([0, maxVal]);

    // create horizontal axis generator
    var xAxis = d3.axisBottom()
        .scale(xScale)
        .tickFormat(function (d) {
            if ((d / 1000) >= 1) {
                d = d / 1000 + "K";
            }
            return d;
        });

    //place horizontal axis
    var axis = chart.append('g')
        .attr('class', 'axis')
        .attr('transform', "translate(0, " + (chartHeight - topBottomPadding) + ")")
        .call(xAxis);

    //set bars for each county
    var bars = chart.selectAll('.bars')
        .data(csvData)
        .enter()
        .append('rect')
        .sort(function(a, b) {
            return a[expressed]-b[expressed];
        })
        .attr('class', function(d) {
            return "bars " + d.OBJECTID;
        })
        .on('mouseover', highlight)
        .on('mouseout', dehighlight)
        .on('mousemove', moveLabel);

    var desc = bars.append('desc')
        .text('{"stroke": "none", "stroke-width": "0px"}');

    // function for repeated parts of both bars sections
    updateChart(bars, csvData.length, colorScale);
};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData) {
    // select element
    var dropdown = d3.select('body')
        .append('select')
        .attr('class', 'dropdown')
        .on('change', function() {
            // finds max val in current csv to use as the high value
            float_list = [];
            for (var i in csvData) {
                if (!isNaN(csvData[i][this.value])) {
                    float_list.push(parseFloat(csvData[i][this.value]));
                };
            };
            maxVal = Math.max.apply(null, float_list);

            updateLegend();
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append('option')
        .attr('class', 'titleOption')
        .attr('disabled', 'true')
        .text('Select Attribute');

    //add attribute name options
    var attrOptions = dropdown.selectAll('attrOptions')
        .data(attrArray)
        .enter()
        .append('option')
        .attr('value', function(d) {
            return d;
        })
        .text(function(d) {
            return d;
        });
};

//function to dropdown change listener handler
function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor choropleth features
    var counties = d3.selectAll('.counties')
        .style('fill', function(d) {
            return choropleth(d.properties, colorScale);
    });

    //re-sort, resize, and recolor bars
    var bars = d3.selectAll('.bars')
        // re-sort bars
        .sort(function(a, b) {
            return a[expressed]-b[expressed];
        })
        .transition()
        .delay(function(d, i) {
            return i * 20;
        })
        .duration(500);

    updateChart(bars, csvData.length, colorScale);
};

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale) {
    var xScale = d3.scaleLinear()
        .range([leftPadding + rightPadding + 1, chartInnerWidth - 10])
        .domain([0, maxVal]);
    //position bars
    bars.attr('x', function (d) {
            return xScale(parseFloat(d[expressed]) / chartInnerWidth);
        })
        .attr('width', function(d) {
            return xScale(parseFloat(d[expressed]));
        })
        //size/resize bars
        .attr('height', chartInnerHeight / n - 1)
        .attr('y', function (d, i) {
            return i * ((chartInnerHeight - 2) / n);
        })
        .style('fill', function (d) {
                return choropleth(d, colorScale);
        });

    //place horizontal axis
    var xAxis = d3.axisBottom()
        .scale(xScale)
        .tickFormat(function (d) {
            if ((d / 1000) >= 1) {
                d = d / 1000 + "K";
            }
            return d;
        });

    //replace horizontal axis
    chart.selectAll('g.axis').remove();
    var axis = chart.append('g')
        .attr('class', 'axis')
        .attr('transform', "translate(0, " + (chartHeight - topBottomPadding) + ")")
        .call(xAxis);

    var chartTitle = d3.select('.chartTitle')
        .text('(' + expressed + ') By Colorado County');
};

//function to join data attributes
function joinData(coloradoCounties, csvData) {
    //join csv and topojson
    for (var i in csvData) {
        var csv_row = csvData[i];
        var csv_key = csv_row.OBJECTID;

        //loop through topojson counties to find correct county
        for (var j in coloradoCounties) {
            var json_props = coloradoCounties[j].properties; //the current county geojson properties
            var json_key = json_props.OBJECTID; //the topojson primary key

            //where primary keys match, transfer csv data to topojson properties object
            if (json_key == csv_key) {
                //assign all attributes and values
                attrArray.forEach(function (attr) {
                    var val = parseFloat(csv_row[attr]);
                    json_props[attr] = val;
                });
            };
        };
    };
    return coloradoCounties;
};

//function to set enumeration units
function setEnumerationUnits(coloradoCounties, map, path, colorScale) {
    //add Colorado counties to map
    var counties = map.selectAll('.counties')
        .data(coloradoCounties)
        .enter()
        .append('path')
        .attr('class', function (d) {
            return "counties " + d.properties.OBJECTID;
        })
        .attr('d', path)
        .style('fill', function(d) {
            return choropleth(d.properties, colorScale);
        })
        .on('mouseover', function(d) {
            highlight(d.properties);
        })
        .on('mouseout', function(d) {
            dehighlight(d.properties);
        })
        .on('mousemove', moveLabel)
        .transition()
        .duration(200);

    var desc = map.selectAll('.counties').append('desc')
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#fee5d9",
        "#fcae91",
        "#fb6a4a",
        "#de2d26",
        "#a50f15"
    ];

    //color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);
    
    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i in data) {
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d) {
        return d3.min(d);
    });

    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};

//function to test for data value and return color
function choropleth(props, colorScale) {
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)) {
        return colorScale(val);
    } else {
        return '#CCC';
    };
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute1 = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";
    var labelAttribute2 = "<h1>No Data</h1><b>" + expressed + "</b>";
    var labelAtt = '';
    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.CountyName + "_label")
        .html(function() {
            if (props[expressed] == 0) {
                return labelAttribute2;
            } else {
                return labelAttribute1;
            }
        });

    var countyName = infolabel.append("div")
        .attr("class", "countyName")
        .html(props.CountyName);
    };

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.CountyName)
        .style("stroke", "green")
        .style("stroke-width", "4");
    setLabel(props)
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.CountyName)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    d3.select('.infolabel')
        .remove()
};

//function to move info label with mouse
function moveLabel() {
    //get width of label
    var labelWidth = d3.select('.infolabel')
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
    
})();