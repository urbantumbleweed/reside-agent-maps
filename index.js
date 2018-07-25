const repl = require('repl');
const {
  reduce,
  flow,
  uniqWith,
  isEqual,
  has,
  get,
  set,
  setWith,
  method,
  uniq,
  compact,
  last,
  without,
  extend,
  lowerCase
} = require('lodash');

const source = require('./sumoData.json');

const teamName = {
  'HH Realty': true,
  'Gueco Real Estate Kevin': true,
  'Navigate Realty': true,
}

console.log(source.length)
const result = flow(
  (source) => uniqWith(source, isEqual),
  (unique) => reduce(
    unique,
    (acc, entry, idx) => {
      const address = entry.Address;

      // parse address string
      const [street, city, stateZip] = compact(address.split(', '));
      const stateAndZip = compact(stateZip.split(' '));
      const zip = last(stateAndZip);
      const state = without(stateAndZip, zip);

      // set state reference
      const statePath = `states[${lowerCase(state)}]`;
      let stateBucket = get(acc, statePath, []);
      stateBucket.push(address);
      setWith(acc, statePath, uniq(stateBucket), Object);

      // set city reference
      const cityPath = `cities[${lowerCase(city)}]`;
      let cityBucket = get(acc, cityPath, []);
      cityBucket.push(address);
      setWith(acc, cityPath, uniq(cityBucket), Object);

      // set zipCode reference
      const zipPath = `zipcodes[${zip}]`;
      let zipBucket = get(acc, zipPath, []);
      zipBucket.push(address);
      setWith(acc, zipPath, uniq(zipBucket), Object);

      // create address objects
      const addressPath = `addresses[${address}]`;
      let addressBucket = get(acc, addressPath, []);
      addressBucket.push(extend({}, entry, { location: { zip, state, city, street }}));
      setWith(acc, addressPath, uniq(addressBucket), Object);

      // set AgentName reference
      const agentName = entry.AgentName;
      if (agentName !== '' && !teamName[agentName]) {
        const agentsPath = `agents[${agentName}]`;
        let agentBucket = get(acc, agentsPath, []);
        agentBucket.push(address);
        setWith(acc, zipPath, uniq(agentBucket), Object);
      }

      // create date lookup
      if (entry.SalesDate !== '') {
        const datePath = entry.SalesDate.replace(/-/g, '.');
        let day = get(acc, datePath, []);
        day.push(address);
        setWith(acc, `date.${datePath}`, uniq(day), Object);
      }
      return acc;
    },
    {}
  ),
  (related) => reduce(
    related.addresses,
    (acc, addressList, address) => {
      const AgentGrossCommission = reduce(
        addressList,
        (sum, { AgentGrossCommission }) => sum + +AgentGrossCommission,
        0
      );
      const AgentName = reduce(
        addressList,
        (name, { AgentName }) => teamName[AgentName] ? name : AgentName,
        ''
      )
      if (!addressList || !addressList['0']) { console.log(addressList); }
      if (addressList) {
        const { NetCommission, TransactionType, BrokerageGrossCommission, SalesPrice } = get(addressList, '[0]', {});
        acc.addresses[address] = extend({}, addressList['0'], { AgentGrossCommission, AgentName });
      }
      return acc;
    },
    related
  )
)(source);
// filter for unique transactions

//for each transaction
  // get the 'address', push it to the accumulator by 'address'
  // parse the date, reference the transaction by address

// for each address object
  // combine values for NetCommission, AgentGrossCommission
  // Select a agent name over team name use mappin object

console.log(result);
