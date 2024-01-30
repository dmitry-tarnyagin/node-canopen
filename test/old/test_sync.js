const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { Device, EdsError } = require('../../index');

const expect = chai.expect;
chai.use(chaiAsPromised);

describe('Sync', function() {
    let device = null;

    beforeEach(function() {
        device = new Device({ id: 0xA, loopback: true });
    });

    describe('Object dictionary updates', function() {
        beforeEach(function() {
            device.sync.cobId = 0x80;
            device.sync.generate = true;
            device.sync.cyclePeriod = 100;
            device.sync.overflow = 10;
            device.init();
        });

        it('should listen for updates to 0x1005', function(done) {
            const obj1005 = device.eds.getEntry(0x1005);
            obj1005.addListener('update', () => {
                setImmediate(() => {
                    expect(device.sync.cobId).to.equal(0x90);
                    expect(device.sync.generate).to.equal(false);
                    done();
                });
            });

            obj1005.value = 0x90;
        });

        it('should listen for updates to 0x1006', function(done) {
            const obj1006 = device.eds.getEntry(0x1006);
            obj1006.addListener('update', () => {
                setImmediate(() => {
                    expect(device.sync.cyclePeriod).to.equal(200);
                    done();
                });
            });

            obj1006.value = 200;
        });

        it('should listen for updates to 0x1019', function(done) {
            const obj1019 = device.eds.getEntry(0x1019);
            obj1019.addListener('update', () => {
                setImmediate(() => {
                    expect(device.sync.overflow).to.equal(20);
                    done();
                });
            });

            obj1019.value = 20;
        });
    });

    describe('Producer', function() {
        it('should produce a sync object', function(done) {
            device.sync.cobId = 0x80;
            device.sync.generate = true;
            device.sync.cyclePeriod = 100;
            device.init();

            device.once('message', () => {
                done();
            });
            device.sync.write();
        });

        it('should increment the counter', function(done) {
            device.sync.cobId = 0x80;
            device.sync.generate = true;
            device.sync.cyclePeriod = 100;
            device.sync.overflow = 255;
            device.init();

            device.addListener('message', (msg) => {
                if(msg.data[0] > 10) {
                    device.sync.stop();
                    done();
                }
            });
            device.sync.start();
        });
    });

    describe('Consumer', function() {
        it('should emit on consuming a sync object', function(done) {
            device.sync.generate = true;
            device.sync.cobId = 0x80;
            device.init();

            device.once('sync', () => {
                done();
            });
            device.sync.write();
        });
    });
});