const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { Device } = require('../../index');

const expect = chai.expect;
chai.use(chaiAsPromised);

describe('Emcy', function() {
    describe('Module initialization', function() {
        it('should create 0x1001', function() {
            const device = new Device({ id: 0xA, loopback: true });
            device.eds.removeEntry(0x1001);
            expect(device.eds.getEntry(0x1001)).to.not.exist;

            device.emcy.init();
            expect(device.eds.getEntry(0x1001)).to.exist;
        });
    });

    describe('Object dictionary', function() {
        let device = null;

        beforeEach(function() {
            device = new Device({ id: 0xA, loopback: true });
            device.emcy.cobId = 0x80;
            device.emcy.inhibitTime = 100;
            device.init();
        });

        it('should configure 0x1003', function(done) {
            // Configure 0x1003 for 10 sub-entries
            device.emcy.setHistoryLength(10);
            expect(device.eds.getEntry(0x1003).subNumber).to.equal(11);

            // Re-configure 0x1003 for 5 sub-entries
            device.emcy.setHistoryLength(5);
            expect(device.eds.getEntry(0x1003).subNumber).to.equal(6);

            done();
        });

        it('should listen for updates to 0x1014', function(done) {
            const obj1014 = device.eds.getEntry(0x1014);
            obj1014.addListener('update', () => {
                setImmediate(() => {
                    expect(device.emcy.cobId).to.equal(0x9A);
                    done();
                });
            });

            obj1014.value = 0x9A;
        });

        it('should listen for updates to 0x1015', function(done) {
            const obj1015 = device.eds.getEntry(0x1015);
            obj1015.addListener('update', () => {
                setImmediate(() => {
                    expect(device.emcy.inhibitTime).to.equal(200);
                    done();
                });
            });

            obj1015.value = 200;
        });
    });

    describe('Producer', function() {
        it('should produce an emergency object', function(done) {
            const device = new Device({ id: 0xA, loopback: true });
            device.emcy.cobId = 0x80;
            device.init();
            device.addListener('message', () => done());
            device.emcy.write(0x1000);
        });
    });

    describe('Consumer', function() {
        let device = null;

        beforeEach(function() {
            device = new Device({ id: 0xA, loopback: true });
            device.emcy.cobId = 0x80;
            device.init();
        });

        it('should emit on consuming an emergency object', function(done) {
            device.on('emergency', () => {
                done();
            });
            device.emcy.write(0x1000);
        });
    });
});