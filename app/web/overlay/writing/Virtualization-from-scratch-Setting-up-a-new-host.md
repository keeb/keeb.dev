---
title: 'Virtualization from scratch: Setting up a new vmhost'
date: 2023-07-03 05:07:31
tags: qemu, virtualization, linux
---

Disclaimer: You really should use something like [Proxmox](https://www.proxmox.com/en/) or VMWare or whatever other out of box hypervisor. Proxmox is the standard for the homelab environment, given its powerful features and zero cost.

If you're opting to use KVM, `virt-manager` is a decent wrapper. 

The method outlined in this post only works for wired ethernet. Wireless needs to be done differently; I may cover that separately.

Disclaimers aside, I like to explore how something really works **under the hood** so lets dive in.

# Environment

The steps in this article are for an `Arch Linux` host, but the concepts can work in any distribution. Most of the work for KVM is taken care of by the package manager for any distro when installing `qemu`.

However, one major change we are making to the system is to by default bind the network interface (`eth0` or `eno1` or similar) to a bridge. This is done so that guest hosts can have their own IP address and be reached indepedently without having to do NAT or other methods like TAP devices.

The leads us to the first important step

# Enable IP forwarding

In order for guests to be reachable for ipv4, your hypervisor needs to turn into, effectively, a switch and forward any traffic it receives to any guests. 

If you do not do this, `DHCP` will not work. If you assign a static IP to the guest, it will not be routable or pingable.

* Edit `/etc/sysctl.d/99-sysctl.conf`
* Add `net.ipv4.ip_forward = 1`

Or, as a simple command

```
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.d/99-sysctl.conf
```


# Set up network

*Note: Be careful here because changing these settings may impact your ability to connect to the machine and management access*

## Create `br0` bridge and network

Edit `/etc/systemd/network/br0.netdev`
```
[NetDev]
Name=br0
Kind=bridge
```

Edit `/etc/systemd/network/br0.network`
```
[Match]
Name=br0

[Network]
DHCP=yes
```

You can also allocate a static IP address for your bridge here. In that case, change the `[Network]` section to

```
[Network]
Address=<Static IP>
Gateway=<Gateway IP>
```

These steps create the devices, will show up in `ip addr` (after network restart), however, will not hooked into your wired network until you connect your physical network with the bridge.

## Connect `br0` bridge to Wired Network 

Bind the bridge to your network interface of choice. In my case, that is `eno1`, so I create a new file. This is, effectively, the glue that connects both worlds.

Edit `/etc/systemd/network/uplink.network`

```
[Match]
Name=eno*

[Network]
Bridge=br0
```

Arch has, by default, some rules in `/etc/systemd/network/20-ethernet.network`. Edit this file and adjust the `[Match]` configuration such that it does not override the changes we made in `uplink.network`.

For me, that was removing `Name=eno*` from `/etc/systemd/network/20-ethernet.network`


## Restart networking

After these steps are completed, restart the `systemd-networkd` service for the changes to take effect.

# Verify

If all has gone according to plan `ip addr show br0` should result in something that looks like the following output

```
3: br0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 36:b0:61:28:49:de brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.12/8 brd 10.255.255.255 scope global br0
       valid_lft forever preferred_lft forever
    inet6 2601:647:100:fee:34b0:61ff:fe28:49de/64 scope global dynamic mngtmpaddr noprefixroute
       valid_lft 596sec preferred_lft 596sec
    inet6 fe80::34b0:61ff:fe28:49de/64 scope link
       valid_lft forever preferred_lft forever
```

In part 2, I'll cover creating the first guest VM, attaching to it, viewing the *screen*, and running a workload.

