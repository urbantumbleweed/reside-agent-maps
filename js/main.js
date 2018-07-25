var god;
var agentCodes = [
  '805155',
  '810567',
  '809007',
  '812230',
  '810274',
  '812593',
  '812733',
  '810761',
  '805322',
  '811078',
  '810575',
  '808465',
  '812181',
  '810412',
  '807480',
  '810606',
  '806744',
];

var calZipCodeTopoJsonUrl =
  "https://raw.githubusercontent.com/storiesofsolidarity/us-data/gh-pages/geography/zcta/California.topo.json";
var resideListings = `https://slipstream.homejunction.com/ws/sales/search?market=sfar&pageSize=1000&listingagent.id=${agentCodes.join('|')}&saleDate=>10/01/2016`
var resideOffers = `https://slipstream.homejunction.com/ws/sales/search?market=sfar&pageSize=1000&sellingagent.id=${agentCodes.join('|')}&saleDate=>10/01/2016`
var neighbors;
var zipCodes = {};
var sales = {};
var geojson;

// Reside colors
var colors = [
  '#85aab2', //lowest
  // '#658386', //low
  '#506568', //middle
  // '#3a4648', //high
  '#292e2f', //highest
];

var slipstreamAuthToken = { 'HJI-Slipstream-Token': 'HJI-B591D977-1E89-433C-8F19-312F44D51AD1' };

window.onload = function() {
  var neighbors;

  function zipcodePopup(props) {
    return (
      `<div class="zpopup">
        <h4>${!!props.area ? (props.area + ' - ') : ''} ${props.id}</h4>
        <hr>
        <h4>Reside Transaction Stats</h4>

        <p class="stat"># Reside Transactions: <span class="value">${props.transactions.length}</span></p>
        <p class="stat">% Market Share: <span class="value">${numeral(props.transactions.length / props.count).format('0.00%')}</span></p>
        <p class="stat">Gross Reside Sales: <span class="value">${numeral(props.aggregate.totalSales).format('($0.00 a)')}</span></p>
        <p class="stat">Reside Sales as % Gross: <span class="value">${numeral(props.aggregate.totalSales / props.measurements.salePrice.sum).format('0.00%')}</span></p>

        <h4>Market Stats for Period 10/1/2016 to 12/31/2017</h4>
        <p class="stat">Gross Sales:  <span class="value">${numeral(props.measurements.salePrice.sum).format('($0.00 a)')}</span></p>
        <p class="stat">Number of Transactions: <span class="value">${props.count}</span></p>
        <p class="stat">Avg Days on Market: <span class="value">${numeral(props.measurements.daysOnMarket.average).format('0')}</span></p>
        <p class="stat">Avg List Price: <span class="value">${numeral(props.measurements.listPrice.average).format('$0,0.00')}</span></p>
        <p class="stat">Avg Sale Price: <span class="value">${numeral(props.measurements.salePrice.average).format('$0,0.00')}</span></p>
      </div>`
    )
  }

  function transactionPopup(transaction){
    const img = _.get(transaction, 'images[0]', false);
    const imgNode = !!img ? (`<img class="tpopup-img" src="${img}"/>`) : '';
    const transactionZip = _.get(transaction, 'address.zip', 'not-found');
    const salePriceZipAverage = _.get(relatedDataWithStats, `zipcodes[${transactionZip}].measurements.salePrice.average`);
    const daysOnMarketZipAverage = _.get(relatedDataWithStats, `zipcodes[${transactionZip}].measurements.daysOnMarket.average`);
    const transactionDaysOnMarket = _.get(transaction, 'daysOnMarket', 0);
    const dayOnMarketDiff = transactionDaysOnMarket - daysOnMarketZipAverage;
    const salesPriceDiff = transaction.salePrice - salePriceZipAverage;
    const salesPriceDiffPercent = (salesPriceDiff / salePriceZipAverage);
    const resideAgent = agentCodes.indexOf(transaction.listingAgent.id) !== -1 ? 'listing' : 'selling';
    const agentName = resideAgent === 'listing' ? transaction.listingAgent.name : transaction.sellingAgent.name;
    const lowerPriceForSellingAgent = salesPriceDiff < 0 && resideAgent === 'selling'
      ? ` and was able to get the buyer a better deal by getting a lower price than usual`
      : '';
    const higherPriceListingAgent = salesPriceDiff > 0 && resideAgent === 'listing'
      ? ' and was able to maximize seller value by getting price that is above average'
      : '';
    const fasterSellingTime = dayOnMarketDiff < 0 && resideAgent === 'listing'
      ? ' and was able to move the property faster than usual'
      : '';
    return (
      `<div class="tpopup">
        <h4>${transaction.area} - ${resideAgent === 'listing' ? 'Listing' : 'Offer'}</h4>
        ${imgNode}
        <p>Location <span class="street">${transaction.address.street}</span></p>
        <p>
          Sold for <span class="price">${numeral(transaction.salePrice).format('$0,0')}</span>
          on <span class="value">${moment.unix(transaction.saleDate).format('M/D/YYYY')}</span> after
          <span class="value">${transactionDaysOnMarket || 'an unknown number of'}</span> days on market.
          This is <span class="value">${numeral(salesPriceDiffPercent).format('0.00%')} ${(salesPriceDiff > 0) ? 'higher' : 'lower'}</span> than the average sale price
          for this market and perod.
        </p>
        <p>
          The listing was on the market
          <span class="value">${!!transactionDaysOnMarket ?  numeral(dayOnMarketDiff).format('0') : 'an unknown number of'} days </span>
          ${dayOnMarketDiff > 0 ? 'longer' : 'shorter'}
          than the average listing for this market.</p>
        <p>
          <span class="agentName">${agentName}</span> was the ${resideAgent} agent
          ${lowerPriceForSellingAgent}${higherPriceListingAgent}${fasterSellingTime}
        </p>
      </div>`
    );
  }

  function style(feat, i) {
    const countMaxObj = _.maxBy(zipCodes.features, f => {
      return _.get(f, 'properties.aggregate.count', 0);
    });
    const countMax = _.get(countMaxObj, 'properties.aggregate.count', 0);
    const rangeStep = parseInt((countMax / colors.length), 10);
    const range = _.range(0, countMax, rangeStep)
    var countColor = d3.scaleLinear()
      .domain(range)
      .range(colors);

    var coco = _.get(feat, 'properties.aggregate.count', 0);
    if (coco === 0) {
      return { fillOpacity: 0.1, weight: 0.8 }
    }

    return { fillColor: countColor(coco), fillOpacity: 0.5, weight: 0.8 };

  }

  var geoJson = Promise.all([
    fetch(calZipCodeTopoJsonUrl).then(r => r.json()),
    fetch(resideListings, {
      headers: new Headers(slipstreamAuthToken)
    }).then(r => r.json()),
    fetch(resideOffers, {
      headers: new Headers(slipstreamAuthToken)
    }).then(r => r.json()),
  ])
    // created relatedDate object for lookups
    .then(([zipCodeTopo, listings, offers]) => {

      const relatedData = _.reduce(
        listings.result.sales.concat(offers.result.sales),
        (dict, sale) => {
          dict.transactions[sale.id] = sale;

          try {
            const zip = sale.address.zip;
            const zipCodePath = `zipcodes[${zip}]`;
            let zipCodeBucket = _.get(dict, zipCodePath, {});
            let zipCodeTransactionBucket = _.get(dict, `${zipCodePath}.transactions`, []);
            let zipCodeAgreggateBucket = _.get(dict, `${zipCodePath}.aggregate`, { totalSales: 0, count: 0 });
            const area = _.get(zipCodeBucket, 'area', sale.area).split(', ');
            zipCodeTransactionBucket.push(sale.id);
            _.setWith(dict, zipCodePath,
              Object.assign({}, zipCodeBucket, {
                transactions: _.uniq(zipCodeTransactionBucket),
                area: `${_.uniq(area.concat([sale.area])).join(', ')}`,
                id: zip,
                aggregate: _.reduce(
                  [sale],
                  (agg) => {
                    agg.totalSales = agg.totalSales + sale.salePrice;
                    agg.count = agg.count + 1;
                    return agg;
                  },
                  Object.assign({}, zipCodeAgreggateBucket),
                )
              }),
              Object
            );

          } catch (e) {
            console.log('problem adding zip');
          }
          // create agent agents lookup
          const sellingAgent = sale.sellingAgent;
          const listingAgent = sale.listingAgent;

          _.forEach([sellingAgent, listingAgent], agent => {
            const agentsPath = `agents[${agent.id}]`;
            try {
              let agentBucket = _.get(dict, `${agentsPath}.transactions`, []);
              agentBucket.push(sale.id);
              _.setWith(dict, agentsPath, Object.assign({}, agent, { transactions: _.uniq(agentBucket)}), Object);
            } catch (e) { console.log(e); }
          })

          // create date lookup
          const saleDate = moment.unix(sale.saleDate);
          var saleYear = saleDate.year();
          var saleMonth = saleDate.month();
          var saleDay = saleDate.date();

          const datePath = `saleDates.${saleYear}.${saleMonth}.${saleDay}`;
          let day = _.get(dict, datePath, []);
          day.push(sale.id);
          _.setWith(dict, datePath, _.uniq(day), Object);

          dict.geojson.features.push({
            type: 'Feature',
            geometry: {
              type: "Point",
              coordinates: [sale.coordinates.latitude, sale.coordinates.longitude]
            },
            properties: {
              listingAgent: sale.listingAgent.name,
              sellingAgent: sale.sellingAgent.name,
              listPrice: sale.listPrice,
              salePrice: sale.salePrice,
              daysOnMarket: sale.daysOnMarket,
              listingDate: moment.unix(sale.listingDate).format('MM/DD/YYYY'),
              saleDate: moment.unix(sale.saleDate).format('MM/DD/YYYY'),
              resideListing: ['RESIDE', 'HEDE'].indexOf(sale.listingOffice.id) !== -1,

            }
          })
          return dict;
        },
        {
          geojson: { type: 'FeatureCollection', features: [] },
          transactions: {},
          zipcodes: {},
          agents: {},
          saleDates: {},
        }
      );

      // create zip code statistics requests
      const zipCodeStatRequests = _.map(
        relatedData.zipcodes,
        (zipObj, zipCode) => ({
          uri: `ws/sales/statistics/measure`,
          parameters: {
            market: 'sfar',
            zip: zipCode,
            listingDate: '10/1/2016:12/31/2017',
            measurements: 'listPrice,salePrice,daysOnMarket',
            groups: 'saleDate:interval(month)'
          }
        }));

      // pass along related data and wait for zipcode stats request
      return Promise.all([
        zipCodeTopo,
        relatedData,
        fetch(
          `https://slipstream.homejunction.com/ws/api/call?request=${JSON.stringify(zipCodeStatRequests)}`,
          {
            headers: new Headers(slipstreamAuthToken),
          }
        ).then(statsResponse => statsResponse.json())
          .then(zipStats => {
            // map request responses to zip codes
            return _.reduce(zipCodeStatRequests, (zipAcc, reqObj, i) => {
              zipAcc[reqObj.parameters.zip] = zipStats.result.responses[i];
              return zipAcc;
            }, {})
          })
      ]);
    })
    // create map with data
    .then(([zipCodeTopo, relatedData, zipStats]) => {
      window.relatedDataWithStats = _.reduce(
        relatedData.zipcodes,
        (acc, zipCodeObj, zipCode) => {

          const count = _.get(zipStats, `[${zipCode}].result.count`, 0);
          let measurements = _.get(zipStats, `[${zipCode}].result.measurements`, {});
          measurements = _.reduce(measurements, (ac, { average }, metricName) => {
            ac[metricName].sum = Math.floor(count * average);
            return ac;
          }, Object.assign({}, measurements))
          acc.zipcodes[zipCode] = _.merge(zipCodeObj,
            {
              grouping: _.get(zipStats, `[${zipCode}].result.grouping`, {}),
              measurements: measurements,
              count: count
            })
          return acc;
        },
        Object.assign({},relatedData)
      )
      return  [zipCodeTopo, relatedDataWithStats]
    })
    .then(([zipCodeTopo, relatedData]) => {
      var layer = "terrain";
      var topoob = {};
      var map = new L.map("mapid").setView([37.707509, -122.375518], 12);

      var MapBoxLight = L.tileLayer(
        'https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoidXJiYW50dW1ibGV3ZWVkIiwiYSI6ImNqNmp0MmY1NDE5OW8zNG1xczR4YnMycHgifQ.6Wm5HN7eilbw49Otpu61hg',
        {
          attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
          maxZoom: 18,
        });

      map.addLayer(MapBoxLight); //new L.StamenTileLayer(layer));
      const topObj = Object.assign({}, zipCodeTopo);
      neighbors = topojson.neighbors(zipCodeTopo.objects['California.geo'].geometries);
      zipCodes = topojson.feature(topObj, zipCodeTopo.objects['California.geo']);
      // sales = topojson.feature(topObj, relatedData.)
      zipCodes.features = _.compact(zipCodes.features.map(function(fm, i) {
        var newProperties = _.get(relatedData, `zipcodes[${fm.id}]`, {});
        var transactions = _.reduce(
          _.get(newProperties, 'transactions', []),
          (ac, id) => ac.concat([_.get(relatedData, `transactions[${id}]`, id)]),
          []
        )
        var ret = fm;
        ret.properties = Object.assign({}, ret.properties, newProperties);
        if (transactions.length) {
          ret.properties.transactions = transactions;
        }
        ret.indie = i;
        if (_.get(ret, 'properties.aggregate.count', 0) === 0) {
          return null;
        }
        return ret;
      }));

      _.forEach(relatedData.transactions, (transaction) => {
        L.marker([transaction.coordinates.latitude, transaction.coordinates.longitude])
          .bindPopup(transactionPopup(transaction))
          .addTo(map);
      })
      geojson = L.geoJson(zipCodes, {
        style: style,
        onEachFeature: onEachFeature
      }).addTo(map);

      function highlightFeature(e) {
        var layer = e.target;
        layer.setStyle({
          weight: 2,
          color: '#e34a33',
          fillColor: '#e34a33',
          dashArray: "",
          fillOpacity: 0.5
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          layer.bringToFront();
        }
        info.update(layer.feature.properties);
      }

      function resetHighlight(e) {
        geojson.resetStyle(e.target);
        info.update();
      }

      function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
      }

      function onEachFeature(feature, layer) {
        layer.on({
          mouseover: highlightFeature,
          mouseout: resetHighlight,
          click: zoomToFeature
        });
      }

      var info = L.control();

      info.onAdd = function(map) {
        this._div = L.DomUtil.create("div", "info");
        this.update();
        return this._div;
      };

      info.update = function(props) {
        this._div.innerHTML =
          (props
            ? zipcodePopup(props)
            : "Hover " + "over a zip code");
      };

      info.addTo(map);
    });
};
