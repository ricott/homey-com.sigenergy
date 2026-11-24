<!-- Text export of 'Sigenergy Modbus Protocol EN_V2.10.pdf' (released 2026-11-03), generated with pdfplumber.
     Tables are rendered as Markdown; figures are omitted. The PDF is authoritative if anything looks garbled.
     Page markers (<!-- page N -->) follow the PDF page index. -->

<!-- page 1 -->
Sigenergy
Modbus Protocol
Version: V2.10
Release date: 2026-11-03

<!-- page 2 -->
Modbus Protocol
Copyright Notice
Copyright© 2023-2026 Sigenergy Technology Co., Ltd. All Rights
Reserved.
Description in this document may contain predictive statements
regarding financial and operating results, product portfolio, new
technology, configurations and features of product. Several factors
could cause difference between actual results and those expressed
or implied in the predictive statements. Therefore, description in this
document is provided for reference purpose only and constitutes
neither an offer nor an acceptance. Sigenergy Technology Co., Ltd.
may change the information at any time without notice.
and other Sigenergy trademarks are owned by Sigenergy
Technology Co., Ltd.
All trademarks and registered trademarks in this document belong
to their owners.

<!-- page 3 -->
Contents
1. Introduction ............................................................................................................................................................. 1
2. Applicable Model .............................................................................................................................................. 2
3. Communication Interface ......................................................................................................................... 3
3.1 RS485 ..............................................................................................................................................................3
3.2 Fast Ethernet/WLAN/Optical fiber/4G ...................................................................................3
3.3 Fast Ethernet/WLAN/Optical fiber/4G* ................................................................................ 4
4. Technical Terms ................................................................................................................................................5
4.1 Technical item name specification ........................................................................................ 5
4.2 Interaction timeout ............................................................................................................................ 6
5. Register Definition ............................................................................................................................................ 7
5.1 Plant running information register definition (input register) .............................7
5.2 Plant parameter setting register definition (holding register) ........................15
5.2.1 Plant parameter setting power limitation register definition
(holding register) ............................................................................................................................. 16
5.2.2 Plant parameter setting power dispatch register definition
(holding register) ............................................................................................................................. 19
5.2.3 Plant parameter setting ESS Preheating register definition (holding
register) ....................................................................................................................................................21
5.2.4 Plant parameter setting others register definition (holding register)
.......................................................................................................................................................................26
5.3 Hybrid inverter(including DC Charger and ESS) running information
register definition (input register) ................................................................................................29
5.4 Hybrid inverter(including DC Charger and ESS) parameter setting
register definition (holding register) ..........................................................................................38
5.5 AC-Charger running information register definition (input register) ...... 39
5.6 AC-Charger parameter setting register definition (holding register) .... 39
6. Modbus Protocol Command Overview ........................................................................................ 40
6.1 Function code ........................................................................................................................................ 41
6.1.1 Read Holding Register .........................................................................................................41

<!-- page 4 -->
Modbus Protocol
6.1.2 Read Input Register .............................................................................................................42
6.1.3 Write a single Register ......................................................................................................43
6.1.4 Write multiple Registers .................................................................................................. 44
6.2 Exception code ...................................................................................................................................45
Appendix 1 Running state ..........................................................................................................................46
Appendix 2 PCS alarm code -- 1..........................................................................................................47
Appendix 3 PCS alarm code -- 2 ........................................................................................................ 48
Appendix 4 ESS alarm code ....................................................................................................................48
Appendix 5 Gateway alarm code ...................................................................................................... 49
Appendix 6 Remote EMS control mode ..........................................................................................49
Appendix 7 AC-Charger system state ............................................................................................50
Appendix 8 AC-Charger alarm code -- 1 .....................................................................................50
Appendix 9 AC-Charger alarm code -- 2 ..................................................................................... 51
Appendix 10 AC-Charger alarm code -- 3 .................................................................................. 52
Appendix 11 DC-Charger alarm code .............................................................................................. 52
Appendix 12 Plant alarm -- 1 ................................................................................................................... 52
Appendix 13 Plant alarm -- 2..................................................................................................................53
Appendix 14 DC-Charger running state .........................................................................................53

<!-- page 5 -->
Modbus Protocol

| Version | Date | Change Description |
|---|---|---|
| V1.0-V1.8 | 2023-08-15 to 2024-08-05 | Added description for interaction timeout. Supporting plant-wide power control. Added definition for alarm severity. Added a few phase power related registers and mode controlling registers. Added DC Charger related registers. Modified and added a few remote EMS and ESS control related registers. Added description of using different Modbus slave address querying different devices or power plant. |
| V2.0 | 2024-10-14 | Added AC-Charger model and it’s related registers. Added AC-Charger related system state and alarm appendix. Added DC-Charger related alarm appendix. Modified appendix names. Modified descriptions of RTU frame and PDU examples in chapter 6. |
| V2.1 | 2024-10-30 | Added “Applicable model abbreviation” definition. Added applicable model columns in chapter 5. Added descriptions for communication interfaces. Added PV related registers. Modified alarm code names. |
| V2.2 | 2024-11-28 | Added description for plant broadcast address. Added inverter level power control related registers. Modified plant parameter registers. |
| V2.3 | 2024-12-09 | Added new applicable models. |
| V2.4 | 2025-02-05 | Modified a few inverter’s registers. |

<!-- page 6 -->
Modbus Protocol

| V2.5 | 2025-02-19 | Added a few plant ESS related registers, two grid point and two PCS power control registers. Modified comments of a few holding registers. Added a few hybrid inverter battery temperature and voltage-related registers. |
|---|---|---|
| V2.6 | 2025-03-31 | Added plant running info registers:plant PV total generation, Total load daily consumption, Total load consumption(30088-30094); Smart load 1-24 total consumption (30098-30144); smart load 1-24 power(30146-30192); Added plant parameter setting registers:[ESS] backup SOC, charge cut-off SOC and discharge cut-off SOC(40046 - 40048); Added hybrid inverter running info registers: ower adjustment related registers feedback value (30613-30619); PV daily generation and PV total generation (31509-31511). |
| V2.7 | 2025-05-23 | Added plant running info registers: Third party inverter power(30194), Cumulative Energy Interface( ); 30196-30268 Added an enumeration to register EMS working mode(30003): “5: Full Feed-in to Grid” and “9: Custom” Deleted hybrid inverter setting parameter: Grid code(40501)  Appendix 1 Running state added an enumeration: Environmental Abnormality 0x07 |
| V2.8 | 2025-11-28 | Added plant running info registers: [Grid code]Rated Frequency(30276), [Grid code]Rated Voltage(30277), Current control command value(30279), Merged Alarm6(30280), Merged Alarm7(30281), General load power 30282, Total load power 30284. Added plant parameter setting registers: Active power regulation gradient(40049), Grid code Interface(40051-40068). Added hybrid inverter running info registers: pv voltage, pv current (31066-31105), [DC Charger] Running state 31513. Deleted hybrid inverter setting parameter: Remote EMS dispatch enable(41500) Added Appendix 12, Appendix 13 and Appendix 14. Added new applicable models. |

<!-- page 7 -->
Modbus Protocol

| V2.9 | 2026-05-13 | Added plant running info registers: [ESS]Average cell temperature 30286. PV total daily generation 30272, PV total generation of previous day 30274 Added plant parameter setting registers: ESS Preheating tou Interface(50000-50183). PCC Power factor adjustment target value(Grid import) 40157, PCC Power factor adjustment target value(Grid export ) 40158, Grid Power Loss Lockout Alarm Clear 40159 Added hybrid inverter running info registers: [DC Charger]dicharging registers 31514-31525. Added hybrid inverter setting parameter: [DC Charger]max charging power limit 41002, [DC Charger]max discharging power limit 41004 Added PSS and PID related registers. Added new applicable models. Added Appendix 15-21. Change "Address definition" to "Register definition" Added explanatory figures for the power limitation registers and power dispatch registers Added description of the series/types supported by DC chargers. Deleted Alarm severity level definition Deleted the note on "Applicable Model", The PV string counts shall be obtained from the register "String count 31025" in the inverter operation information table. ： Added enumeration value to register( ) 0x07 40031 – – Reserved, 0x08 V2G (Vehicle to Grid) Replace all occurrences of "interface" with "register" in descriptions. |
|---|---|---|
| V2.10 | 2026-11-03 | Added plant running info registers: [Grid sensor] Phase A/B/C current 30292-30296, [Grid sensor] Phase A/B/C voltage 30298-30302. Added plant parameter setting registers: Reactive power regulation gradient 40160. 5.2.1 Updated the activation conditions for ESS max charging limit40032, ESS max discharging limit 40034, and PV max power limit40036. 5.2.4 Added the Remote EMS power limit global enable register 40162 . Deleted PSS and PID related registers. Deleted appendices 15-21. Updated the applicable models. |

<!-- page 8 -->
Modbus Protocol
1. Introduction
This Modbus protocol complies the standard Modbus Application protocol
specification. The physical media is multiple, such as RS485, Fast Ethernet, WLAN,
Optical fiber and 4G. The figure below shows a simple host-slave mode in
Modbus protocol.
Specifically, in a inverter-consisted power plant, to request information or
control an individual devices, Modbus frames should be sent to the
corresponding device’s Modbus slave address, which must be set to a unique
value among a inverter-consisted power plant in App. To request plant
information or control plant behavior, Modbus frames should be sent to Modbus
slave address 247, known as the “plant address”. To control plant behavior and
to not receive Modbus reply, Modbus frames should be sent to Modbus slave
address 0, known as the “plant broadcast address”.
1 / 54

<!-- page 9 -->
Modbus Protocol
2. Applicable Model
Table 2-1 lists the machine models applicable to this protocol. Each applicable
model abbreviation in the table represents all the machine models listed to its
right. In Chapter 5, "Register Address Definition," each register corresponds to a
specific applicable model abbreviation, indicating that the register can only be
read or written by the machine models the abbreviation represents.
Table 2-1 Applicable models
2 / 54

| Applicable model abbreviation | Model |
|---|---|
| Hybrid Inv. | SigenStor EC (3.0, 3.6, 4.0, 4.6, 5.0, 6.0, 8.0, 10.0, 12.0) SP series |
|  | Sigen Hybrid (3.0, 3.6, 4.0, 4.6, 5.0, 6.0) SP |
|  | Sigen Hybrid (5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 17.0, 20.0, 25.0, 30.0) TP series |
|  | SigenStor EC (5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 17.0, 20.0, 25.0, 30.0) TP/TPLV series |
|  | Sigen PV (50, 60, 80, 99.9, 100, 110, 125)M1-HYA series |
|  | PG Controller (3.8, 4.8, 5.7, 7.6, 9.6, 11.4) series |
|  | Sigen PV (50, 60, 80, 99.9, 100, 110,125)M1-HYB series |
|  | Sigen Hybrid (2.0, 2.5, 3.0, 3.6, 4.0, 4.6, 5.0, 6.0) SP2series |
|  | Sigen Hybrid (3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0) TP2series |
| EVAC | Sigen EVAC (7, 11, 22) 4G T2 WH |
|  | Sigen EVAC (7, 11, 22) 4G T2SH WH |
|  | PG EVAC (9.6, 11.5) series |
| PV Inv. | Sigen PV Max (3.0, 3.6, 4.0, 4.6, 5.0, 6.0) SP |
|  | Sigen PV Max (5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 17.0, 20.0, 25.0) TP |
|  | Sigen PV (50, 60, 80, 99.9, 100, 110, 125, 150, 166)M1 series |
|  | Sigen PV (500)H1 series |
|  | Sigen PV (370, 400)H2 series |

<!-- page 10 -->
Modbus Protocol
3. Communication Interface
3.1 RS485
For applicable model abbreviation type "EVAC" devices, the interface described
in this section is not supported.
For applicable model abbreviation type "Hybrid Inv." and “PV Inv.” devices,
third-party controllers only need to connect to one device in the power plant
through the interface (RS485) described in this section and can read or write
registers of all devices within the power plant (with different modbus slave
addresses). The power plant can consist of multiple parallel-connected "Hybrid
Inv." or “PV Inv.” devices.
Table 3-1 RS485 interface description
3.2 Fast Ethernet/WLAN/Optical fiber/4G
For applicable model abbreviation type "Hybrid Inv." and “PV Inv.” devices,
3 / 54

| Parameter | Description |
|---|---|
| Transfer mode | RTU mode |
| Communication mode | Half duplex |
| Baud rate | 9600bps(default) |
| Start bit | 1 |
| Data bit | 8 |
| Check bit | None |
| Stop bit | 1 |

<!-- page 11 -->
Modbus Protocol
third-party controllers only need to connect to one device in the power plant
through the interface described in this section and can read or write registers of
all devices within the power plant (with different modbus slave addresses). The
power plant can consist of multiple parallel-connected "Hybrid Inv." or “PV
Inv.” devices.
For applicable model abbreviation type “EVAC” device, it must be connected to
a "Hybrid Inv." or “PV Inv.”device. Third-party controllers have to connect to the
"Hybrid Inv." or “PV Inv.” device using the interface described in this section to
access registers of the “EVAC” device.
Table 3-2 Fast Ethernet/WLAN/Optical fiber/4G interface description
3.3 Fast Ethernet/WLAN/Optical fiber/4G*
For applicable model abbreviation type "Hybrid Inv." and “PV Inv.” devices,
third-party controllers only need to connect to one device in the power plant
through the interface described in this section and can read or write registers of
all devices within the power plant (with different modbus slave addresses). The
power plant can consist of multiple parallel-connected "Hybrid Inv." or “PV
4 / 54

| Parameter | Description |
|---|---|
| Transfer mode | TCP mode |
| Communication mode | Full duplex |
| Link layer Mode | TCP Server |
| Application layer Mode | Slave |
| Port | 502 |

<!-- page 12 -->
Modbus Protocol
Inv.” devices.
For applicable model abbreviation type “EVAC” device, it must be connected to
a "Hybrid Inv." or “PV Inv.” device. Third-party controllers have to connect to the
"Hybrid Inv." or “PV Inv.” device using the interface described in this section to
access registers of the “EVAC” device.
Table 3-3 Fast Ethernet/WLAN/Optical fiber/4G interface description
*Note :To be specific, if 4G is the only physical communication media, the protocol then only
supports one inverter device to connect the third party cloud as a client.
4. Technical Terms
4.1 Technical item name specification
Table 4-1 Technical item description
5 / 54

| Parameter | Description |
|---|---|
| Transfer mode | TCP mode |
| Communication mode | Full duplex |
| Link layer Mode | TCP Client |
| Application layer Mode | Slave |
| Port | custom |

| Item | Description |
|---|---|
| Host | The one that initiates an application request is referred to the host |
| Slave | The one that responds to an application request is referred to the slave |
| Access plant address | 247 |
| Plant broadcast address | 0 |

<!-- page 13 -->
Modbus Protocol
4.2 Interaction timeout
A communication process following the Modbus protocol should always be
stared by a host.
Minimum Request period : 100 ms
Response timeout: 1000 ms
The interval between the transmission start times of two consecutive unicast
requests shall be at least 100 ms. After sending a unicast request, the master
shall wait for a complete response from the slave. The next unicast request may
be sent only after a complete response has been received and the minimum
request interval specified above has elapsed.
6 / 54

| Slave address range | 1-246 |
|---|---|
| U16 | Unsigned integer of 16-bit |
| U32 | Unsigned integer of 32-bit |
| U64 | Unsigned integer of 64-bit |
| S16 | Signed integer of 16-bit |
| S32 | Signed integer of 32-bit |
| STRING | Character string in ASCII |
| BIT16 | Bit-mapped integer |
| RO | Read only, only support 0x04 command |
| WO | Write only, only support 0x06 command |
| RW | 、 、 Read and write, support 0x04 0x06 0x10 command |

<!-- page 14 -->
Modbus Protocol
If the master does not receive a complete response from the slave within 1000
ms, it shall consider the request timed out. Under poor network conditions or
when using long RS485 cable runs, the response timeout may be increased as
appropriate.
Plant broadcast address:
When the host sends a broadcast request to Modbus slave address 0, the
devices will perform but will not reply Modbus frame.
5. Register Definition
5.1 Plant running information register definition (input register)
The registers below can only be accessed by slave address 247, namely “plant
address”. To obtain power plant data, inquiries should be send to address 247.
Table 5-1 Plant running information register definition
7 / 54

| No . | Name | Add. | QT Y | Per m. | Data Type | Gain | Unit | Hyb rid Inv, | PV inv. | Comment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | System time | 30000 | 2 | RO | U32 | 1 | s | √ | √ | Epoch seconds |
| 2 | System time zone | 30002 | 1 | RO | S16 | 1 | min | √ | √ |  |
| 3 | EMS work mode | 30003 | 1 | RO | U16 | N/A | N/A | √ | √ | 0: Max self consumption; 1: AI Mode; 2: TOU 5: Full Feed-in to Grid 7: Remote EMS mode 9: Custom |
| 4 | [Grid Sensor] Status | 30004 | 1 | RO | U16 | N/A | N/A | √ | √ | (gateway or meter connection status) 0: not connected 1: connected |

<!-- page 15 -->
Modbus Protocol
8 / 54

| 5 | [Grid sensor] Active power | 30005 | 2 | RO | S32 | 1000 | kW | √ | √ | Data collected from grid sensor at grid to system checkpoint; >0 buy from grid; <0 sell to grid |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | [Grid sensor] Reactive power | 30007 | 2 | RO | S32 | 1000 | kVar | √ | √ | Data collected from grid sensor at grid to system checkpoint; |
| 7 | On/Off Grid status | 30009 | 1 | RO | U16 | N/A | N/A | √ |  | 0: on grid 1: off grid (auto) 2: off grid (manual) |
| 8 | Max active power | 30010 | 2 | RO | U32 | 1000 | kW | √ | √ | This is should be the base value of all active power adjustment actions |
| 9 | Max apparent power | 30012 | 2 | RO | U32 | 1000 | kVA | √ | √ | This is should be the base value of all reactive power adjustment actions |
| 10 | [ESS] SOC | 30014 | 1 | RO | U16 | 10 | % | √ |  |  |
| 11 | Plant phase A active power | 30015 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 12 | Plant phase B active power | 30017 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 13 | Plant phase C active power | 30019 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 14 | Plant phase A reactive power | 30021 | 2 | RO | S32 | 1000 | kVar | √ | √ |  |
| 15 | Plant phase B reactive power | 30023 | 2 | RO | S32 | 1000 | kVar | √ | √ |  |
| 16 | Plant phase C reactive power | 30025 | 2 | RO | S32 | 1000 | kVar | √ | √ |  |
| 17 | Merged Alarm1 | 30027 | 1 | RO | U16 | N/A | N/A | √ | √ | If any hybrid inverter has alarm , then this alarm will be set accordingly. Refer to Appendix 2 |
| 18 | Merged Alarm2 | 30028 | 1 | RO | U16 | N/A | N/A | √ | √ | If any hybrid inverter has alarm , then this alarm will be set accordingly. Refer to Appendix 3 |
| 19 | Merged Alarm3 | 30029 | 1 | RO | U16 | N/A | N/A | √ |  | If any hybrid inverter has alarm , then this alarm will be set accordingly. Refer to Appendix 4 |

<!-- page 16 -->
Modbus Protocol
9 / 54

| 20 | Merged Alarm4 | 30030 | 1 | RO | U16 | N/A | N/A | √ | √ | If any hybrid inverter has alarm , then this alarm will be set accordingly. Refer to Appendix 5 |
|---|---|---|---|---|---|---|---|---|---|---|
| 21 | Plant active power | 30031 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 22 | Plant reactive power | 30033 | 2 | RO | S32 | 1000 | kVar | √ | √ |  |
| 23 | Photovoltaic power | 30035 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 24 | [ESS] Power | 30037 | 2 | RO | S32 | 1000 | kW | √ |  | <0: discharging >0: charging |
| 25 | Available max active power | 30039 | 2 | RO | U32 | 1000 | kW | √ | √ | Feed to the ac terminal. Count only the running inverters |
| 26 | Available min active power | 30041 | 2 | RO | U32 | 1000 | kW | √ |  | Absorb from the ac terminal. Count only the running inverters |
| 27 | Available max reactive power | 30043 | 2 | RO | U32 | 1000 | kVar | √ | √ | Feed to the ac terminal. Count only the running inverters |
| 28 | Available min reactive power | 30045 | 2 | RO | U32 | 1000 | kVar | √ | √ | Absorb from the ac terminal. Count only the running inverters |
| 29 | [ESS]Available max charging power | 30047 | 2 | RO | U32 | 1000 | kW | √ |  | Count only the running inverters |
| 30 | [ESS]Available max discharging power | 30049 | 2 | RO | U32 | 1000 | kW | √ |  | Count only the running inverters |
| 31 | Plant running state | 30051 | 1 | RO | U16 | N/A | N/A | √ | √ | Refer to Appendix 1 |
| 32 | [Grid sensor] Phase A active power | 30052 | 2 | RO | S32 | 1000 | kW | √ | √ | Data collected from grid sensor at grid to system checkpoint; >0 buy from grid; <0 sell to grid |
| 33 | [Grid sensor] Phase B active power | 30054 | 2 | RO | S32 | 1000 | kW | √ | √ | Data collected from grid sensor at grid to system checkpoint; >0 buy from grid; <0 sell to grid |

<!-- page 17 -->
Modbus Protocol
10 / 54

| 34 | [Grid sensor] Phase C active power | 30056 | 2 | RO | S32 | 1000 | kW | √ | √ | Data collected from grid sensor at grid to system checkpoint; >0 buy from grid; <0 sell to grid |
|---|---|---|---|---|---|---|---|---|---|---|
| 35 | [Grid sensor] Phase A reactive power | 30058 | 2 | RO | S32 | 1000 | kVar | √ | √ | Data collected from grid sensor at grid to system checkpoint; |
| 36 | [Grid sensor] Phase B reactive power | 30060 | 2 | RO | S32 | 1000 | kVar | √ | √ | Data collected from grid sensor at grid to system checkpoint; |
| 37 | [Grid sensor] Phase C reactive power | 30062 | 2 | RO | S32 | 1000 | kVar | √ | √ | Data collected from grid sensor at grid to system checkpoint; |
| 38 | [ESS]Available max charging capacity | 30064 | 2 | RO | U32 | 100 | kWh | √ |  | Count only the running inverters |
| 39 | [ESS]Available max discharging capacity | 30066 | 2 | RO | U32 | 100 | kWh | √ |  | Count only the running inverters |
| 40 | [ESS] Rated charging power | 30068 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 41 | [ESS] Rated discharging power | 30070 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 42 | Merged Alarm5 | 30072 | 1 | RO | U16 | N/A | N/A | √ |  | If any hybrid inverter has alarm , then this alarm will be set accordingly. Refer to Appendix 11 |
| 43 | Reserved | 30073 | 10 | RO | N/A | N/A | N/A |  |  |  |
| 44 | [ESS] Rated energy capacity | 30083 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 45 | [ESS] Charge Cut-Off SOC | 30085 | 1 | RO | U16 | 10 | % | √ |  |  |
| 46 | [ESS] Discharge Cut-Off SOC | 30086 | 1 | RO | U16 | 10 | % | √ |  |  |
| 47 | [ESS] SOH | 30087 | 1 | RO | U16 | 10 | % | √ |  | This value is the weighted average of the SOH of all ESS devices in the power plant, with each rated capacity as the weight. |

<!-- page 18 -->
Modbus Protocol
11 / 54

| 48 | Plant PV total generation | 30088 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 49 | Total load daily consumption | 30092 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 50 | Total load consumption | 30094 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 51 | [Smart load 1] Total consumption | 30098 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 52 | [Smart load 2] Total consumption | 30100 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 53 | [Smart load 3] Total consumption | 30102 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 54 | [Smart load 4] Total consumption | 30104 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 55 | [Smart load 5] Total consumption | 30106 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 56 | [Smart load 6] Total consumption | 30108 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 57 | [Smart load 7] Total consumption | 30110 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 58 | [Smart load 8] Total consumption | 30112 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 59 | [Smart load 9] Total consumption | 30114 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 60 | [Smart load 10] Total consumption | 30116 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 61 | [Smart load 11] Total consumption | 30118 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 62 | [Smart load 12] Total consumption | 30120 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 63 | [Smart load 13] Total consumption | 30122 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 64 | [Smart load 14] Total consumption | 30124 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 65 | [Smart load 15] Total consumption | 30126 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 66 | [Smart load 16] Total consumption | 30128 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 67 | [Smart load 17] Total consumption | 30130 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 68 | [Smart load 18] Total consumption | 30132 | 2 | RO | U32 | 100 | kWh | √ | √ |  |

<!-- page 19 -->
Modbus Protocol
12 / 54

| 69 | [Smart load 19] Total consumption | 30134 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 70 | [Smart load 20] Total consumption | 30136 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 71 | [Smart load 21] Total consumption | 30138 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 72 | [Smart load 22] Total consumption | 30140 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 73 | [Smart load 23] Total consumption | 30142 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 74 | [Smart load 24] Total consumption | 30144 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 75 | [Smart load 1] Power | 30146 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 76 | [Smart load 2] Power | 30148 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 77 | [Smart load 3] Power | 30150 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 78 | [Smart load 4] Power | 30152 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 79 | [Smart load 5] Power | 30154 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 80 | [Smart load 6] Power | 30156 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 81 | [Smart load 7] Power | 30158 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 82 | [Smart load 8] Power | 30160 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 83 | [Smart load 9] Power | 30162 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 84 | [Smart load 10] Power | 30164 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 85 | [Smart load 11] Power | 30166 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 86 | [Smart load 12] Power | 30168 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 87 | [Smart load 13] Power | 30170 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 88 | [Smart load 14] Power | 30172 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 89 | [Smart load 15] Power | 30174 | 2 | RO | S32 | 1000 | kW | √ | √ |  |

<!-- page 20 -->
Modbus Protocol
13 / 54

| 90 | [Smart load 16] Power | 30176 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 91 | [Smart load 17] Power | 30178 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 92 | [Smart load 18] Power | 30180 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 93 | [Smart load 19] Power | 30182 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 94 | [Smart load 20] Power | 30184 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 95 | [Smart load 21] Power | 30186 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 96 | [Smart load 22] Power | 30188 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 97 | [Smart load 23] Power | 30190 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 98 | [Smart load 24] Power | 30192 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 99 | Third Party inverter active power | 30194 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 100 | Total generation of third party inverter | 30196 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 101 | Total charged energy of the ESS | 30200 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 102 | Total discharged energy of the ESS | 30204 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 103 | Total charged energy of the EVDC | 30208 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 104 | Total discharged energy of the EVDC | 30212 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 105 | Total imported energy | 30216 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 106 | Total exported energy | 30220 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 107 | Total energy output of oil-fueled generator | 30224 | 4 | RO | U64 | 100 | kWh | √ | √ |  |
| 108 | Total energy consumption of common loads | 30228 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface, excluding EVAC and EVDC charged energy. |

<!-- page 21 -->
Modbus Protocol
14 / 54

| 109 | Total charged energy of the EVAC | 30232 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface, |
|---|---|---|---|---|---|---|---|---|---|---|
| 110 | Total generation of self PV | 30236 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface, excluding generation of third party inverter |
| 111 | Total generation of third party inverter | 30240 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 112 | Total charged energy of the ESS | 30244 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 113 | Total discharged energy of the ESS | 30248 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 114 | Total charged energy of the EVDC | 30252 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 115 | Total discharged energy of the EVDC | 30256 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 116 | Total imported energy | 30260 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 117 | Total exported energy | 30264 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 118 | Total energy output of oil-fueled generator | 30268 | 4 | RO | U64 | 100 | kWh | √ | √ | New statistics interface |
| 119 | PV total daily generation | 30272 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 120 | PV total generation of previous day | 30274 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 121 | [Grid code]Rated Frequency | 30276 | 1 | RO | U16 | 100 | Hz | √ | √ |  |
| 122 | [Grid code]Rated Voltage | 30277 | 2 | RO | U32 | 100 | V | √ | √ |  |
| 123 | Current control command value | 30279 | 1 | RO | U16 | 100 | % | √ | √ | Use of Remote Output Control in Japan |
| 124 | Merged Alarm6 | 30280 | 1 | RO | U16 | N/A | N/A | √ | √ | Refer to Appendix 12 |
| 125 | Merged Alarm7 | 30281 | 1 | RO | U16 | N/A | N/A | √ | √ | Refer to Appendix 13 |
| 126 | General load power | 30282 | 2 | RO | S32 | 1000 | kW | √ | √ |  |

<!-- page 22 -->
Modbus Protocol
*Note1 : For the new energy-statistics interface (registers 30228~30268), after upgrading the
device firmware to support this interface, the register values will reset to 0 and start fresh
counting without inheriting historical data.
*Note2 : [Grid sensor] current/voltage registers (30292~30302), only SigenStor, Sigen Hybrid
support.
5.2 Plant parameter setting register definition (holding register)
The registers below can only be accessed by slave address 0 or 247. To modify
plant-level registers, send commands to address 0 or 247. When sending
commands to address 0, the device will only execute and will not reply. When
sending commands to address 247, the device will both execute and respond.
15 / 54

| 127 | Total load power | 30284 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 128 | [ESS]Average cell temperature | 30286 | 1 | RO | S16 | 10 | ℃ | √ |  |  |
| 129 | Reserved | 30287 | 5 | RO | N/A | N/A | N/A |  |  |  |
| 130 | [Grid sensor] Phase A current | 30292 | 2 | RO | S32 | 100 | A | √ | √ |  |
| 131 | [Grid sensor] Phase B current | 30294 | 2 | RO | S32 | 100 | A | √ | √ |  |
| 132 | [Grid sensor] Phase C current | 30296 | 2 | RO | S32 | 100 | A | √ | √ |  |
| 133 | [Grid sensor] Phase A voltage | 30298 | 2 | RO | U32 | 100 | V | √ | √ |  |
| 134 | [Grid sensor] Phase B voltage | 30300 | 2 | RO | U32 | 100 | V | √ | √ |  |
| 135 | [Grid sensor] Phase C voltage | 30302 | 2 | RO | U32 | 100 | V | √ | √ |  |

<!-- page 23 -->
Modbus Protocol
*Note1 : ESS only SigenStor, Sigen Hybrid, Sigen PV M1-HYB series support.
*Note2 : DC Charger only SigenStor, Sigen Hybrid support.
*Note3: The Modbus registers related to the above components are only valid in the
supported series.
5.2.1 Plant parameter setting power limitation register definition (holding
register)
 
The ESS max charging limit (40032), ESS max discharging limit (40034),

and PV max power limit (40036) in Table 5-2-1 take effect when either of the
following conditions is met:

a. The value of the Modbus register Remote EMS power limit global enable
(40162) is 1;

b. The value of the Modbus register EMS work mode (30003) is 7, indicating
that the system is operating in Remote EMS scheduling mode.
When register 40162 is set to 1, the three power limit commands take effect
regardless of the current EMS work mod.
When register 40162 is set to 0, the three power limit commands take effect only
 “
when EMS work mode (30003) is set to 7. If EMS work mode (30003) is
not set to 7, the three power limit commands are not applied to system power
16 / 54

<!-- page 24 -->
Modbus Protocol
control.
The default value of register 40162 is 0. When the three power limit commands
are not in effect, their registers and corresponding signals remain readable,
writable, and retained, and the configured values are not cleared. When either
activation condition is met again, the system applies the currently retained
power limit values.
Table 5-2-1 Plant setting parameter power limitation register definition
17 / 54

| No. | Name | Add. | Q T Y | Perm. | Data Type | Gain | Unit | Hyb rid Inv, | PV inv. | Comment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ESS max charging limit | 40032 | 2 | RW | U32 | 1000 | kW | √ |  | [0, Rated ESS charging power]. Takes effect when either activation condition specified in this section is met. |
| 2 | ESS max discharging limit | 40034 | 2 | RW | U32 | 1000 | kW | √ |  | [0, Rated ESS discharging power]. Takes effect when either activation condition specified in this section is met. |
| 3 | PV max power limit | 40036 | 2 | RW | U32 | 1000 | kW | √ |  | Takes effect when either activation condition specified in this section is met. |
| 4 | [Grid Point]Maximum export limitation | 40038 | 2 | RW | U32 | 1000 | kW | √ | √ | Grid Sensor needed. Takes effect globally regardless of the EMS operating mode. |
| 5 | [Grid Point] Maximum import limitation | 40040 | 2 | RW | U32 | 1000 | kW | √ | √ | Grid Sensor needed. Takes effect globally regardless of the EMS operating mode. |
| 6 | PCS maximum export limitation | 40042 | 2 | RW | U32 | 1000 | kW | √ | √ | 。 Range:[0, 0xFFFFFFFE] With value 0xFFFFFFFF, register is not valid. In all other cases, |

<!-- page 25 -->
Modbus Protocol
*Note1 : Without grid sensor, The control objective of the registers 40157 and 40158 has been
changed from “PCC Power” to “PCS Power”.
*Note2 : Register 40157 and 40158 only Sigen PV M1-HYB series support.
As shown in the above figure, the specific points where the power limitation
registers take effect are as follows:
①
(1) PV max power limit, The command applies at the location marked in
figure, meaning that the maximum output power of the PV strings in the plant
must not exceed the value configured in this register.
②
(2) ESS max charging limit, The command applies at the location marked in
figure, meaning that the maximum charging power of the ESS in the plant must
not exceed the value configured in this register.
②
(3) ESS max discharging limit, The command applies at the location marked
in figure, meaning that the maximum discharging power of the ESS in the plant
must not exceed the value configured in this register.
(4) PCS maximum export limitation, The command applies at the location
③
marked in figure, meaning that the maximum active power output of the
inverter in the plant must not exceed the value configured in this register.
18 / 54

|  |  |  |  |  |  |  |  |  |  | Takes effect globally. |
|---|---|---|---|---|---|---|---|---|---|---|
| 7 | PCS maximum import limitation | 40044 | 2 | RW | U32 | 1000 | kW | √ | √ | 。 Range:[0, 0xFFFFFFFE] With value 0xFFFFFFFF, register is not valid. In all other cases, Takes effect globally. |
| 8 | PCC Power factor adjustment target value (Grid import) | 40157 | 1 | RW | S16 | 1000 | N/A | √ | √ | Range: (-1, -0.8] U [0.8, 1]. Grid Sensor needed.Takes effect upon grid import. |
| 9 | PCC Power factor adjustment target value (Grid export ) | 40158 | 1 | RW | S16 | 1000 | N/A | √ | √ | Range: (-1, -0.8] U [0.8, 1].Grid Sensor needed.Takes effect upon grid export. |

<!-- page 26 -->
Modbus Protocol
(5) PCS maximum import limitation, The command applies at the location
③
marked in figure, meaning that the maximum active power input of the
inverter in the plant must not exceed the value configured in this register.
(6) [Grid Point]Maximum export limitation, The command applies at the location
④
marked in figure, meaning that the maximum active power fed into the grid
must not exceed the value configured in this register.
(7) [Grid Point]Maximum import limitation, The command applies at the
④
location marked in figure, meaning that the maximum active power
absorbed from the grid must not exceed the value configured in this register.
(8) PCC Power factor adjustment target value (Grid import), The command
④
applies at the location marked in figure, meaning that when purchasing
electricity at the grid connection point, the power factor must be controlled to
the value configured in this register.
(9) PCC Power factor adjustment target value (Grid export), The command
④
applies at the location marked in figure, meaning that when selling
electricity at the grid connection point, the power factor must be controlled to
the value configured in this register.
5.2.2 Plant parameter setting power dispatch register definition (holding
register)
③
The power dispatch registers in Table 5-2-2 applies at the location marked in figure. For
these registers to take effect, the following two conditions must be met:
a. The Modbus register for remote EMS enable (40029) is set to 0x01;
b. The Modbus register for remote EMS control mode (40031) is set to 0x00.
19 / 54

<!-- page 27 -->
Modbus Protocol
*Note : These registers only control the power of PCS and is independent of loads and grid
sensors.
Table 5-2-2 Plant setting parameter power dispatch register definition
20 / 54

| No. | Name | Add. | Q T Y | Perm. | Data Type | Gain | Unit | Hyb rid Inv, | PV inv. | Comment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Active power fixed adjustment target value | 40001 | 2 | RW | S32 | 1000 | kW | √ | √ |  |
| 2 | Reactive power fixed adjustment target value | 40003 | 2 | RW | S32 | 1000 | kVar | √ | √ | Range: [-60.00 * base value ,60.00 * base value]. |
| 3 | Active power percentage adjustment target value | 40005 | 1 | RW | S16 | 100 | % | √ | √ | Range: [-100.00,100.00] |
| 4 | Q/S adjustment target value | 40006 | 1 | RW | S16 | 100 | % | √ | √ | Range: [-60.00,60.00]. |
| 5 | Power factor adjustment target value | 40007 | 1 | RW | S16 | 1000 | N/A | √ | √ | Range: (-1, -0.8] U [0.8, 1]. |
| 6 | Phase A active power fixed adjustment target value | 40008 | 2 | RW | S32 | 1000 | kW | √ | √ | Valid only when output type is L1/L2/L3/N |
| 7 | Phase B active power fixed adjustment target value | 40010 | 2 | RW | S32 | 1000 | kW | √ | √ | Valid only when output type is L1/L2/L3/N |
| 8 | Phase C active power fixed adjustment target value | 40012 | 2 | RW | S32 | 1000 | kW | √ | √ | Valid only when output type is L1/L2/L3/N |
| 9 | Phase A reactive power fixed adjustment target value | 40014 | 2 | RW | S32 | 1000 | kVar | √ | √ | Valid only when output type is L1/L2/L3/N |
| 10 | Phase B reactive power fixed adjustment target value | 40016 | 2 | RW | S32 | 1000 | kVar | √ | √ | Valid only when output type is L1/L2/L3/N |
| 11 | Phase C reactive power fixed adjustment target value | 40018 | 2 | RW | S32 | 1000 | kVar | √ | √ | Valid only when output type is L1/L2/L3/N |
| 12 | Phase A Active power percentage adjustment target value | 40020 | 1 | RW | S16 | 100 | % | √ | √ | Valid only when output type is L1/L2/L3/N. Range: [-100.00,100.00] |
| 13 | Phase B Active power percentage adjustment target value | 40021 | 1 | RW | S16 | 100 | % | √ | √ | Valid only when output type is L1/L2/L3/N. Range: [-100.00,100.00] |

<!-- page 28 -->
Modbus Protocol
5.2.3 Plant parameter setting ESS Preheating register definition (holding
register)
Table 5-2-3 Plant setting parameter ESS Preheating register definition
21 / 54

| 14 | Phase C Active power percentage adjustment target value | 40022 | 1 | RW | S16 | 100 | % | √ | √ | Valid only when output type is L1/L2/L3/N. Range: [-100.00,100.00] |
|---|---|---|---|---|---|---|---|---|---|---|
| 15 | Phase A Q/S fixed adjustment target value | 40023 | 1 | RW | S16 | 100 | % | √ | √ | Valid only when output type is L1/L2/L3/N. Range: [-60.00,60.00] |
| 16 | Phase B Q/S fixed adjustment target value | 40024 | 1 | RW | S16 | 100 | % | √ | √ | Valid only when output type is L1/L2/L3/N. Range: [-60.00,60.00] |
| 17 | Phase C Q/S fixed adjustment target value | 40025 | 1 | RW | S16 | 100 | % | √ | √ | Valid only when output type is L1/L2/L3/N. Range: [-60.00,60.00] |

| No. | Name | Add. | Q T Y | Perm. | Data Type | Gain | Unit | Hyb rid Inv, | PV inv. | Comment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [ESS Preheating ] Preheating Enable | 50000 | 1 | RW | U16 | N/A | N/A | √ |  | 0: Disable 1: Enable |
| 2 | [ESS Preheating ] Preheating mode | 50001 | 1 | RW | U16 | N/A | N/A | √ |  | 0: Automatic 1: Manual |
| 3 | [ESS Preheating ] Advance Preheating Enable | 50002 | 1 | RW | U16 | N/A | N/A | √ |  | 0: Disable 1: Enable Takes effect when Preheating mode is manual. |
| 4 | [ESS Preheating ] tou 1:Start Time | 50003 | 2 | RW | U32 | 1 | s | √ |  | Epoch seconds with time zone to local time |
| 5 | [ESS Preheating ] tou 1:End Time | 50005 | 2 | RW | U32 | 1 | s | √ |  | Epoch seconds with time zone to local time |
| 6 | [ESS Preheating ] tou 1:Target Charging/ Discharging Power | 50007 | 2 | RW | S32 | 1000 | kW | √ |  | <0: discharging >0: charging |
| 7 | [ESS Preheating ] tou 2:Start Time | 50009 | 2 | RW | U32 | 1 | s | √ |  |  |
| 8 | [ESS Preheating ] tou 2:End Time | 50011 | 2 | RW | U32 | 1 | s | √ |  |  |

<!-- page 29 -->
Modbus Protocol
22 / 54

| 9 | [ESS Preheating ] tou 2:Target Charging/ Discharging Power | 50013 | 2 | RW | S32 | 1000 | kW | √ |  |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | [ESS Preheating ] tou 3:Start Time | 50015 | 2 | RW | U32 | 1 | s | √ |  |  |
| 11 | [ESS Preheating ] tou 3:End Time | 50017 | 2 | RW | U32 | 1 | s | √ |  |  |
| 12 | [ESS Preheating ] tou 3:Target Charging/ Discharging Power | 50019 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 13 | [ESS Preheating ] tou 4:Start Time | 50021 | 2 | RW | U32 | 1 | s | √ |  |  |
| 14 | [ESS Preheating ] tou 4:End Time | 50023 | 2 | RW | U32 | 1 | s | √ |  |  |
| 15 | [ESS Preheating ] tou 4:Target Charging/ Discharging Power | 50025 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 16 | [ESS Preheating ] tou 5:Start Time | 50027 | 2 | RW | U32 | 1 | s | √ |  |  |
| 17 | [ESS Preheating ] tou 5:End Time | 50029 | 2 | RW | U32 | 1 | s | √ |  |  |
| 18 | [ESS Preheating ] tou 5:Target Charging/ Discharging Power | 50031 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 19 | [ESS Preheating ] tou 6:Start Time | 50033 | 2 | RW | U32 | 1 | s | √ |  |  |
| 20 | [ESS Preheating ] tou 6:End Time | 50035 | 2 | RW | U32 | 1 | s | √ |  |  |
| 21 | [ESS Preheating ] tou 6:Target Charging/ Discharging Power | 50037 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 22 | [ESS Preheating ] tou 7:Start Time | 50039 | 2 | RW | U32 | 1 | s | √ |  |  |
| 23 | [ESS Preheating ] tou 7:End Time | 50041 | 2 | RW | U32 | 1 | s | √ |  |  |
| 24 | [ESS Preheating ] tou 7:Target Charging/ Discharging Power | 50043 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 25 | [ESS Preheating ] tou 8:Start Time | 50045 | 2 | RW | U32 | 1 | s | √ |  |  |
| 26 | [ESS Preheating ] tou 8:End Time | 50047 | 2 | RW | U32 | 1 | s | √ |  |  |

<!-- page 30 -->
Modbus Protocol
23 / 54

| 27 | [ESS Preheating ] tou 8:Target Charging/ Discharging Power | 50049 | 2 | RW | S32 | 1000 | kW | √ |  |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 28 | [ESS Preheating ] tou 9:Start Time | 50051 | 2 | RW | U32 | 1 | s | √ |  |  |
| 29 | [ESS Preheating ] tou 9:End Time | 50053 | 2 | RW | U32 | 1 | s | √ |  |  |
| 30 | [ESS Preheating ] tou 9:Target Charging/ Discharging Power | 50055 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 31 | [ESS Preheating ] tou 10:Start Time | 50057 | 2 | RW | U32 | 1 | s | √ |  |  |
| 32 | [ESS Preheating ] tou 10:End Time | 50059 | 2 | RW | U32 | 1 | s | √ |  |  |
| 33 | [ESS Preheating ] tou 10:Target Charging/ Discharging Power | 50061 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 34 | [ESS Preheating ] tou 11:Start Time | 50063 | 2 | RW | U32 | 1 | s | √ |  |  |
| 35 | [ESS Preheating ] tou 11:End Time | 50065 | 2 | RW | U32 | 1 | s | √ |  |  |
| 36 | [ESS Preheating ] tou 11:Target Charging/ Discharging Power | 50067 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 37 | [ESS Preheating ] tou 12:Start Time | 50069 | 2 | RW | U32 | 1 | s | √ |  |  |
| 38 | [ESS Preheating ] tou 12:End Time | 50071 | 2 | RW | U32 | 1 | s | √ |  |  |
| 39 | [ESS Preheating ] tou 12:Target Charging/ Discharging Power | 50073 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 40 | [ESS Preheating ] tou 13:Start Time | 50075 | 2 | RW | U32 | 1 | s | √ |  |  |
| 41 | [ESS Preheating ] tou 13:End Time | 50077 | 2 | RW | U32 | 1 | s | √ |  |  |
| 42 | [ESS Preheating ] tou 13:Target Charging/ Discharging Power | 50079 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 43 | [ESS Preheating ] tou 14:Start Time | 50081 | 2 | RW | U32 | 1 | s | √ |  |  |
| 44 | [ESS Preheating ] tou 14:End Time | 50083 | 2 | RW | U32 | 1 | s | √ |  |  |

<!-- page 31 -->
Modbus Protocol
24 / 54

| 45 | [ESS Preheating ] tou 14:Target Charging/ Discharging Power | 50085 | 2 | RW | S32 | 1000 | kW | √ |  |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 46 | [ESS Preheating ] tou 15:Start Time | 50087 | 2 | RW | U32 | 1 | s | √ |  |  |
| 47 | [ESS Preheating ] tou 15:End Time | 50089 | 2 | RW | U32 | 1 | s | √ |  |  |
| 48 | [ESS Preheating ] tou 15:Target Charging/ Discharging Power | 50091 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 49 | [ESS Preheating ] tou 16:Start Time | 50093 | 2 | RW | U32 | 1 | s | √ |  |  |
| 50 | [ESS Preheating ] tou 16:End Time | 50095 | 2 | RW | U32 | 1 | s | √ |  |  |
| 51 | [ESS Preheating ] tou 16:Target Charging/ Discharging Power | 50097 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 52 | [ESS Preheating ] tou 17:Start Time | 50099 | 2 | RW | U32 | 1 | s | √ |  |  |
| 53 | [ESS Preheating ] tou 17:End Time | 50101 | 2 | RW | U32 | 1 | s | √ |  |  |
| 54 | [ESS Preheating ] tou 17:Target Charging/ Discharging Power | 50103 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 55 | [ESS Preheating ] tou 18:Start Time | 50105 | 2 | RW | U32 | 1 | s | √ |  |  |
| 56 | [ESS Preheating ] tou 18:End Time | 50107 | 2 | RW | U32 | 1 | s | √ |  |  |
| 57 | [ESS Preheating ] tou 18:Target Charging/ Discharging Power | 50109 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 58 | [ESS Preheating ] tou 19:Start Time | 50111 | 2 | RW | U32 | 1 | s | √ |  |  |
| 59 | [ESS Preheating ] tou 19:End Time | 50113 | 2 | RW | U32 | 1 | s | √ |  |  |
| 60 | [ESS Preheating ] tou 19:Target Charging/ Discharging Power | 50115 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 61 | [ESS Preheating ] tou 20:Start Time | 50117 | 2 | RW | U32 | 1 | s | √ |  |  |
| 62 | [ESS Preheating ] tou 20:End Time | 50119 | 2 | RW | U32 | 1 | s | √ |  |  |

<!-- page 32 -->
Modbus Protocol
25 / 54

| 63 | [ESS Preheating ] tou 20:Target Charging/ Discharging Power | 50121 | 2 | RW | S32 | 1000 | kW | √ |  |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 64 | [ESS Preheating ] tou 21:Start Time | 50123 | 2 | RW | U32 | 1 | s | √ |  |  |
| 65 | [ESS Preheating ] tou 21:End Time | 50125 | 2 | RW | U32 | 1 | s | √ |  |  |
| 66 | [ESS Preheating ] tou 21:Target Charging/ Discharging Power | 50127 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 67 | [ESS Preheating ] tou 22:Start Time | 50129 | 2 | RW | U32 | 1 | s | √ |  |  |
| 68 | [ESS Preheating ] tou 22:End Time | 50131 | 2 | RW | U32 | 1 | s | √ |  |  |
| 69 | [ESS Preheating ] tou 22:Target Charging/ Discharging Power | 50133 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 70 | [ESS Preheating ] tou 23:Start Time | 50135 | 2 | RW | U32 | 1 | s | √ |  |  |
| 71 | [ESS Preheating ] tou 23:End Time | 50137 | 2 | RW | U32 | 1 | s | √ |  |  |
| 72 | [ESS Preheating ] tou 23:Target Charging/ Discharging Power | 50139 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 73 | [ESS Preheating ] tou 24:Start Time | 50141 | 2 | RW | U32 | 1 | s | √ |  |  |
| 74 | [ESS Preheating ] tou 24:End Time | 50143 | 2 | RW | U32 | 1 | s | √ |  |  |
| 75 | [ESS Preheating ] tou 24:Target Charging/ Discharging Power | 50145 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 76 | [ESS Preheating ] tou 25:Start Time | 50147 | 2 | RW | U32 | 1 | s | √ |  |  |
| 77 | [ESS Preheating ] tou 25:End Time | 50149 | 2 | RW | U32 | 1 | s | √ |  |  |
| 78 | [ESS Preheating ] tou 25:Target Charging/ Discharging Power | 50151 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 79 | [ESS Preheating ] tou 26:Start Time | 50153 | 2 | RW | U32 | 1 | s | √ |  |  |
| 80 | [ESS Preheating ] tou 26:End Time | 50155 | 2 | RW | U32 | 1 | s | √ |  |  |

<!-- page 33 -->
Modbus Protocol
*Note1 : ESS Preheating registers (50000~50183), only Sigen PV M1-HYA/HYB series support.
5.2.4 Plant parameter setting others register definition (holding register)
Table 5-2-4 Plant setting parameter others register definition
26 / 54

| 81 | [ESS Preheating ] tou 26:Target Charging/ Discharging Power | 50157 | 2 | RW | S32 | 1000 | kW | √ |  |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 82 | [ESS Preheating ] tou 27:Start Time | 50159 | 2 | RW | U32 | 1 | s | √ |  |  |
| 83 | [ESS Preheating ] tou 27:End Time | 50161 | 2 | RW | U32 | 1 | s | √ |  |  |
| 84 | [ESS Preheating ] tou 27:Target Charging/ Discharging Power | 50163 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 85 | [ESS Preheating ] tou 28:Start Time | 50165 | 2 | RW | U32 | 1 | s | √ |  |  |
| 86 | [ESS Preheating ] tou 28:End Time | 50167 | 2 | RW | U32 | 1 | s | √ |  |  |
| 87 | [ESS Preheating ] tou 28:Target Charging/ Discharging Power | 50169 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 88 | [ESS Preheating ] tou 29:Start Time | 50171 | 2 | RW | U32 | 1 | s | √ |  |  |
| 89 | [ESS Preheating ] tou 29:End Time | 50173 | 2 | RW | U32 | 1 | s | √ |  |  |
| 90 | [ESS Preheating ] tou 29:Target Charging/ Discharging Power | 50175 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 91 | [ESS Preheating ] tou 30:Start Time | 50177 | 2 | RW | U32 | 1 | s | √ |  |  |
| 92 | [ESS Preheating ] tou 30:End Time | 50179 | 2 | RW | U32 | 1 | s | √ |  |  |
| 93 | [ESS Preheating ] tou 30:Target Charging/ Discharging Power | 50181 | 2 | RW | S32 | 1000 | kW | √ |  |  |
| 94 | [ESS Preheating ] Preheating reserved SOC | 50183 | 1 | RW | U16 | 100 | % | √ |  | Range: [0,100.0] |

| No. | Name | Add. | Q T Y | Perm. | Data Type | Gain | Unit | Hyb rid Inv, | PV inv. | Comment |
|---|---|---|---|---|---|---|---|---|---|---|

<!-- page 34 -->
Modbus Protocol
27 / 54

| 1 | Start/Stop | 40000 | 1 | WO | U16 | N/A | N/A | √ | √ | 0: Stop 1: Start |
|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Reserved | 40026 | 3 | RW | N/A | N/A | N/A |  |  |  |
| 3 | Remote EMS enable | 40029 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: disabled 1: enabled When needed to control EMS remotely, this register needs to be enabled. When enabled, the plant’s EMS work mode (30003) will switch to remote EMS. |
| 4 | Independent phase power control enable | 40030 | 1 | RW | U16 | N/A | N/A | √ | √ | Valid only when output type is L1/L2/L3/N. To enable independent phase control, this parameter must be enabled. 0: disabled 1: enabled |
| 5 | Remote EMS control mode | 40031 | 1 | RW | U16 | N/A | N/A | √ | √ | Mode values’ definition refer to Appendix 6 |
| 6 | [ESS]Backup SOC | 40046 | 1 | RW | U16 | 10 | % | √ |  | Range: [0,100.0] |
| 7 | [ESS] Charge Cut-Off SOC | 40047 | 1 | RW | U16 | 10 | % | √ |  | Range: [0,100.0] |
| 8 | [ESS] Discharge Cut-Off SOC | 40048 | 1 | RW | U16 | 10 | % | √ |  | Range: [0,100.0] |
| 9 | Active power regulation gradient | 40049 | 2 | RW | U32 | 1000 | %/s | √ | √ | 。 Range:[0, 5000] Percentage of rated power adjusted per second |
| 10 | [Grid code]LVRT enable | 40051 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Disable 1: Enable |
| 11 | [Grid code]LVRT reactive power compensation factor | 40052 | 1 | RW | U16 | 100 | N/A | √ | √ | Range:[0,10.0] |
| 12 | [Grid code]LVRT negative-sequence reactive power compensation factor | 40053 | 1 | RW | U16 | 100 | N/A | √ | √ | Range:[0,10.0] |
| 13 | [Grid code]LVRT mode | 40054 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Reactive power compensation current, active zero-current mode 2: Zero-current mode |

<!-- page 35 -->
Modbus Protocol
28 / 54

|  |  |  |  |  |  |  |  |  |  | 3: Constant current mode 4: Reactive dynamic current, active zero-current mode 5: Reactive power compensation current, active constant-current mode |
|---|---|---|---|---|---|---|---|---|---|---|
| 14 | [Grid code]LVRT grid voltage protection blocking | 40055 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Not block 1: Block |
| 15 | [Grid code]HVRT enable | 40056 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Disable 1: Enable |
| 16 | [Grid code]HVRT reactive power compensation factor | 40057 | 1 | RW | U16 | 100 | N/A | √ | √ | Range:[0,10.0] |
| 17 | [Grid code]HVRT negative-sequence reactive power compensation factor | 40058 | 1 | RW | U16 | 100 | N/A | √ | √ | Range:[0,10.0] |
| 18 | [Grid code]HVRT mode | 40059 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Reactive power compensation current, active zero-current mode 2: Zero-current mode 3: Constant current mode 4: Reactive dynamic current, active hold mode 5: Reactive power compensation current, active constant-current mode |
| 19 | [Grid code]HVRT grid voltage protection blocking | 40060 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Not block 1: Block |
| 20 | [Grid code]Over- frequency derating enable | 40061 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Disable 1: Enable |
| 21 | [Grid code]Over- frequency derating power ramp rate | 40062 | 1 | RW | U16 | 100 | % | √ | √ | Range:[0,100.0] |
| 22 | [Grid code]Over- frequency derating trigger frequency | 40063 | 1 | RW | U16 | 100 | Hz | √ | √ | Range:[1.0*Fn, 1.2*Fn] Reference:[Grid code]Rated Frequency (Register 30276 ) |

<!-- page 36 -->
Modbus Protocol
*Note1 : Independent phase power control registers (40008~40025, 40030), only SigenStor,
Sigen Hybrid, Sigen PV M1-HYB series support.
*Note2 : Grid code registers (40051~40068), only SigenStor, Sigen Hybrid support.
5.3 Hybrid inverter(including DC Charger and ESS) running
information register definition (input register)
The registers below can only be accessed with a valid Hybrid inverter’s Modbus
slave address (1-246), and the Modbus slave address must be configured using
29 / 54

| 23 | [Grid code]Over- frequency derating cut-off frequency | 40064 | 1 | RW | U16 | 100 | Hz | √ | √ | Range:[1.0*Fn, 1.2*Fn] Reference:[Grid code]Rated Frequency (Register 30276 ) |
|---|---|---|---|---|---|---|---|---|---|---|
| 24 | [Grid code]Under- frequency power boost enable | 40065 | 1 | RW | U16 | N/A | N/A | √ | √ | 0: Disable 1: Enable |
| 25 | [Grid code]Under- frequency power boost power ramp rate | 40066 | 1 | RW | U16 | 100 | % | √ | √ | Range:[0,100.0] |
| 26 | [Grid code]Under- frequency power boost trigger frequency | 40067 | 1 | RW | U16 | 100 | Hz | √ | √ | Range:[0.8*Fn, 1.0*Fn] Reference:[Grid code]Rated Frequency (Register 30276 ) |
| 27 | [Grid code]Under- frequency power boost cut-off frequency | 40068 | 1 | RW | U16 | 100 | Hz | √ | √ | Range:[0.8*Fn, 1.0*Fn] Reference:[Grid code]Rated Frequency (Register 30276 ) |
| 28 | Reserved | 40069 -4015 6 | 8 8 | RW | N/A | N/A | N/A |  |  |  |
| 29 | Grid Power Loss Lockout Alarm Clear | 40159 | 1 | WO | U16 | N/A | N/A | √ | √ | 1: Clear alarm Other values are ignored. |
| 30 | Reactive power regulation gradient | 40160 | 2 | RW | U32 | 1000 | %/s | √ | √ | 。 Range:[0, 5000] |
| 31 | Remote EMS power limit global enable | 40162 | 1 | RW | U16 | N/A | N/A | √ |  | 0: Disable 1: Enable |
| 32 | Reserved | 40163 -4023 3 | 7 1 | RW | N/A | N/A | N/A |  |  |  |

<!-- page 37 -->
Modbus Protocol
the MySigen APP. When using PV string related registers, please refer to the string
count register(31025) value in Table 5-3 (Inverter Operating Information
Registers), to ensure if the register is available.
Table 5-3 Hybrid inverter(including DC Charger and ESS) running information
register definition
30 / 54

| No. | Name | Add. | QT Y | Per m. | Data Type | Gain | Unit | Hyb rid Inv, | PV inv. | Comment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 8Model type | 30500 | 15 | RO | STRING | N/A | N/A | √ | √ |  |
| 2 | 9Serial number | 30515 | 10 | RO | STRING | N/A | N/A | √ | √ |  |
| 3 | 1Machine firmware 0version | 30525 | 15 | RO | STRING | N/A | N/A | √ | √ |  |
| 4 | 1Rated active power 1 | 30540 | 2 | RO | U32 | 1000 | kW | √ | √ |  |
| 5 | 1Max. 2apparent power | 30542 | 2 | RO | U32 | 1000 | kVA | √ | √ |  |
| 6 | 1Max. active power 3 | 30544 | 2 | RO | U32 | 1000 | kW | √ | √ |  |
| 7 | 1Max. 4absorption power | 30546 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 8 | 1Rated battery capacity 5 | 30548 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 9 | 1[ESS]Rated charge 6power | 30550 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 10 | 1[ESS]Rated discharge 7power | 30552 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 11 | 1Reserved 8 | 30554 | 12 | RO | N/A | N/A | N/A |  |  |  |
| 12 | 2[ESS]Daily charge 2energy | 30566 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 13 | 2[ESS]Accumulated 3charge energy | 30568 | 4 | RO | U64 | 100 | kWh | √ |  |  |
| 14 | 2[ESS]Daily discharge 4energy | 30572 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 15 | 2[ESS]Accumulated 5discharge energy | 30574 | 4 | RO | U64 | 100 | kWh | √ |  |  |

<!-- page 38 -->
Modbus Protocol
31 / 54

| 16 | 2Running state 6 | 30578 | 1 | RO | U16 | N/A | N/A | √ | √ | Refer to Appendix 1 |
|---|---|---|---|---|---|---|---|---|---|---|
| 17 | 2Max.active power 7adjustment value | 30579 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 18 | 2Min. active power 8adjustment value | 30581 | 2 | RO | S32 | 1000 | kW | √ |  |  |
| 19 | 2Max. reactive power 9adjustment value fed to the ac terminal | 30583 | 2 | RO | U32 | 1000 | kVar | √ | √ |  |
| 20 | 3Max. reactive power 0adjustment value absorbed from the ac terminal | 30585 | 2 | RO | U32 | 1000 | kVar | √ | √ |  |
| 21 | 3Active power 1 | 30587 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 22 | 3Reactive power 2 | 30589 | 2 | RO | S32 | 1000 | kVar | √ | √ |  |
| 23 | 3[ESS]Max. battery 3charge power | 30591 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 24 | 3[ESS]Max. battery 4discharge power | 30593 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 25 | 3[ESS]Available battery 5charge Energy | 30595 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 26 | 3[ESS]Available battery 6discharge Energy | 30597 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 27 | 3[ESS] Charge / 7discharge power | 30599 | 2 | RO | S32 | 1000 | kW | √ |  |  |
| 28 | 3[ESS]Battery SOC 8 | 30601 | 1 | RO | U16 | 10 | % | √ |  |  |
| 29 | 3[ESS]Battery SOH 9 | 30602 | 1 | RO | U16 | 10 | % | √ |  |  |
| 30 | 4[ESS]Average cell 0temperature | 30603 | 1 | RO | S16 | 10 | ℃ | √ |  |  |
| 31 | 4[ESS] Average cell 1voltage | 30604 | 1 | RO | U16 | 1000 | V | √ |  |  |
| 32 | 4Alarm1 2 | 30605 | 1 | RO | U16 | N/A | N/A | √ | √ | Refer to Appendix 2 |
| 33 | 4Alarm2 3 | 30606 | 1 | RO | U16 | N/A | N/A | √ | √ | Refer to Appendix 3 |
| 34 | 4Alarm3 4 | 30607 | 1 | RO | U16 | N/A | N/A | √ |  | Refer to Appendix 4 |
| 35 | 4Alarm4 5 | 30608 | 1 | RO | U16 | N/A | N/A | √ | √ | Refer to Appendix 5 |

<!-- page 39 -->
Modbus Protocol
32 / 54

| 36 | Alarm5 | 30609 | 1 | RO | U16 | N/A | N/A | √ |  | Refer to Appendix 11 |
|---|---|---|---|---|---|---|---|---|---|---|
| 37 | Reserved | 30610 | 3 | RO | N/A | N/A | N/A |  |  |  |
| 38 | Active power fixed value adjustment feedback | 30613 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 39 | Reactive power fixed value adjustment feedback | 30615 | 2 | RO | S32 | 1000 | kVar | √ | √ |  |
| 40 | Active power percentage adjustment feedback | 30617 | 1 | RO | S16 | 100 | % | √ | √ |  |
| 41 | Reactive power Q/S adjustment feedback | 30618 | 1 | RO | S16 | 100 | % | √ | √ |  |
| 42 | Power factor adjustment feedback | 30619 | 1 | RO | S16 | 1000 | N/A | √ | √ |  |
| 43 | [ESS]Maximum battery (cluster) temperature | 30620 | 1 | RO | S16 | 10 | ℃ | √ |  |  |
| 44 | [ESS]Minimum battery (cluster) temperature | 30621 | 1 | RO | S16 | 10 | ℃ | √ |  |  |
| 45 | [ESS] Maximum battery (cluster) cell voltage | 30622 | 1 | RO | U16 | 1000 | V | √ |  |  |
| 46 | [ESS] Minimum battery (cluster) cell voltage | 30623 | 1 | RO | U16 | 1000 | V | √ |  |  |
| 47 | 4Rated grid voltage 6 | 31000 | 1 | RO | U16 | 10 | V | √ | √ |  |
| 48 | 4Rated grid frequency 7 | 31001 | 1 | RO | U16 | 100 | Hz | √ | √ |  |
| 49 | 4Grid frequency 8 | 31002 | 1 | RO | U16 | 100 | Hz | √ | √ |  |
| 50 | 4[PCS] Internal 9temperature | 31003 | 1 | RO | S16 | 10 | ℃ | √ | √ |  |
| 51 | 5Output type 0 | 31004 | 1 | RO | U16 | N/A | N/A | √ | √ | 0: L/N 1: L1/L2/L3 2: L1/L2/L3/N 3: L1/L2/N |
| 52 | 5A-B line voltage 1 | 31005 | 2 | RO | U32 | 100 | V | √ | √ | Invalid when output type is L/N, L1/L2/N, or L1/L2/N |
| 53 | 5B-C line voltage 2 | 31007 | 2 | RO | U32 | 100 | V | √ | √ |  |
| 54 | 5C-A line voltage 3 | 31009 | 2 | RO | U32 | 100 | V | √ | √ |  |

<!-- page 40 -->
Modbus Protocol
33 / 54

| 55 | 5Phase A voltage 4 | 31011 | 2 | RO | U32 | 100 | V | √ | √ | When output type is L/N, refers to “Phase voltage” |
|---|---|---|---|---|---|---|---|---|---|---|
| 56 | 5Phase B voltage 5 | 31013 | 2 | RO | U32 | 100 | V | √ | √ | Invalid when output type is L/N, L1/L2/N, or L1/L2/N |
| 57 | 5Phase C voltage 6 | 31015 | 2 | RO | U32 | 100 | V | √ | √ |  |
| 58 | 5Phase A current 7 | 31017 | 2 | RO | S32 | 100 | A | √ | √ | When output type is L/N, refers to “Phase current” |
| 59 | 5Phase B current 8 | 31019 | 2 | RO | S32 | 100 | A | √ | √ | Invalid when output type is L/N, L1/L2/N, or L1/L2/N |
| 60 | 5Phase C current 9 | 31021 | 2 | RO | S32 | 100 | A | √ | √ |  |
| 61 | 6Power factor 0 | 31023 | 1 | RO | S16 | 1000 | N/A | √ | √ |  |
| 62 | 6PACK count 1 | 31024 | 1 | RO | U16 | 1 | N/A | √ |  |  |
| 63 | 6PV string count 2 | 31025 | 1 | RO | U16 | 1 | N/A | √ | √ |  |
| 64 | 6MPPT count 3 | 31026 | 1 | RO | U16 | 1 | N/A | √ | √ |  |
| 65 | 6PV1 voltage 4 | 31027 | 1 | RO | S16 | 10 | V | √ | √ | Please refer to the PV string count |
| 66 | 6PV1 current 5 | 31028 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 67 | 6PV2 voltage 6 | 31029 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 68 | 6PV2 current 7 | 31030 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 69 | 6PV3 voltage 8 | 31031 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 70 | 6PV3 current 9 | 31032 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 71 | 7PV4 voltage 0 | 31033 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 72 | 7PV4 current 1 | 31034 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 73 | 7PV power 2 | 31035 | 2 | RO | S32 | 1000 | kW | √ | √ |  |
| 74 | 7Insulation resistance 3 | 31037 | 1 | RO | U16 | 1000 | M Ω | √ | √ |  |

<!-- page 41 -->
Modbus Protocol
34 / 54

| 75 | 7Startup time 4 | 31038 | 2 | RO | U32 | 1 | s | √ | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 76 | 7Shutdown time 5 | 31040 | 2 | RO | U32 | 1 | s | √ | √ |  |
| 77 | PV5 voltage | 31042 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 78 | PV5 current | 31043 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 79 | PV6 voltage | 31044 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 80 | PV6 current | 31045 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 81 | PV7 voltage | 31046 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 82 | PV7 current | 31047 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 83 | PV8 voltage | 31048 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 84 | PV8 current | 31049 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 85 | PV8 current | 31050 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 86 | PV9 current | 31051 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 87 | PV10 voltage | 31052 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 88 | PV10 current | 31053 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 89 | PV11 voltage | 31054 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 90 | PV11 current | 31055 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 91 | PV12 voltage | 31056 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 92 | PV12 current | 31057 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 93 | PV13 voltage | 31058 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 94 | PV13 current | 31059 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 95 | PV14 voltage | 31060 | 1 | RO | S16 | 10 | V | √ | √ |  |

<!-- page 42 -->
Modbus Protocol
35 / 54

| 96 | PV14 current | 31061 | 1 | RO | S16 | 100 | A | √ | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 97 | PV15 voltage | 31062 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 98 | PV15 current | 31063 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 99 | PV16 voltage | 31064 | 1 | RO | S16 | 10 | V | √ | √ |  |
| 100 | PV16 current | 31065 | 1 | RO | S16 | 100 | A | √ | √ |  |
| 101 | PV17 voltage | 31066 | 1 | RO | S16 | 10 | V |  | √ |  |
| 102 | PV17 current | 31067 | 1 | RO | S16 | 100 | A |  | √ |  |
| 103 | PV18 voltage | 31068 | 1 | RO | S16 | 10 | V |  | √ |  |
| 104 | PV18 current | 31069 | 1 | RO | S16 | 100 | A |  | √ |  |
| 105 | PV19 voltage | 31070 | 1 | RO | S16 | 10 | V |  | √ |  |
| 106 | PV19 current | 31071 | 1 | RO | S16 | 100 | A |  | √ |  |
| 107 | PV20 voltage | 31072 | 1 | RO | S16 | 10 | V |  | √ |  |
| 108 | PV20 current | 31073 | 1 | RO | S16 | 100 | A |  | √ |  |
| 109 | PV21 voltage | 31074 | 1 | RO | S16 | 10 | V |  | √ |  |
| 110 | PV21 current | 31075 | 1 | RO | S16 | 100 | A |  | √ |  |
| 111 | PV22 voltage | 31076 | 1 | RO | S16 | 10 | V |  | √ |  |
| 112 | PV22 current | 31077 | 1 | RO | S16 | 100 | A |  | √ |  |
| 113 | PV23 voltage | 31078 | 1 | RO | S16 | 10 | V |  | √ |  |
| 114 | PV23 current | 31079 | 1 | RO | S16 | 100 | A |  | √ |  |
| 115 | PV24 voltage | 31080 | 1 | RO | S16 | 10 | V |  | √ |  |
| 116 | PV24 current | 31081 | 1 | RO | S16 | 100 | A |  | √ |  |

<!-- page 43 -->
Modbus Protocol
36 / 54

| 117 | PV25 voltage | 31082 | 1 | RO | S16 | 10 | V |  | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 118 | PV25 current | 31083 | 1 | RO | S16 | 100 | A |  | √ |  |
| 119 | PV26 voltage | 31084 | 1 | RO | S16 | 10 | V |  | √ |  |
| 120 | PV26 current | 31085 | 1 | RO | S16 | 100 | A |  | √ |  |
| 121 | PV27 voltage | 31086 | 1 | RO | S16 | 10 | V |  | √ |  |
| 122 | PV27 current | 31087 | 1 | RO | S16 | 100 | A |  | √ |  |
| 123 | PV28 voltage | 31088 | 1 | RO | S16 | 10 | V |  | √ |  |
| 124 | PV28 current | 31089 | 1 | RO | S16 | 100 | A |  | √ |  |
| 125 | PV29 voltage | 31090 | 1 | RO | S16 | 10 | V |  | √ |  |
| 126 | PV29 current | 31091 | 1 | RO | S16 | 100 | A |  | √ |  |
| 127 | PV30 voltage | 31092 | 1 | RO | S16 | 10 | V |  | √ |  |
| 128 | PV30 current | 31093 | 1 | RO | S16 | 100 | A |  | √ |  |
| 129 | PV31 voltage | 31094 | 1 | RO | S16 | 10 | V |  | √ |  |
| 130 | PV31 current | 31095 | 1 | RO | S16 | 100 | A |  | √ |  |
| 131 | PV32 voltage | 31096 | 1 | RO | S16 | 10 | V |  | √ |  |
| 132 | PV32 current | 31097 | 1 | RO | S16 | 100 | A |  | √ |  |
| 133 | PV33 voltage | 31098 | 1 | RO | S16 | 10 | V |  | √ |  |
| 134 | PV33 current | 31099 | 1 | RO | S16 | 100 | A |  | √ |  |
| 135 | PV34 voltage | 31100 | 1 | RO | S16 | 10 | V |  | √ |  |
| 136 | PV34 current | 31101 | 1 | RO | S16 | 100 | A |  | √ |  |
| 137 | PV35 voltage | 31102 | 1 | RO | S16 | 10 | V |  | √ |  |

<!-- page 44 -->
Modbus Protocol
*Note : DC Charger only SigenStor, Sigen Hybrid support.
37 / 54

| 138 | PV35 current | 31103 | 1 | RO | S16 | 100 | A |  | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 139 | PV36 voltage | 31104 | 1 | RO | S16 | 10 | V |  | √ |  |
| 140 | PV36 current | 31105 | 1 | RO | S16 | 100 | A |  | √ |  |
| 141 | [DC Charger] Vehicle battery voltage | 31500 | 1 | RO | U16 | 10 | V | √ |  |  |
| 142 | [DC Charger] Charging current | 31501 | 1 | RO | U16 | 10 | A | √ |  |  |
| 143 | [DC Charger] Output power | 31502 | 2 | RO | S32 | 1000 | kW | √ |  |  |
| 144 | [DC Charger] Vehicle SOC | 31504 | 1 | RO | U16 | 10 | % | √ |  |  |
| 145 | [DC Charger] Current charging capacity | 31505 | 2 | RO | U32 | 100 | kWh | √ |  | Single time |
| 146 | [DC Charger] Current charging duration | 31507 | 2 | RO | U32 | 1 | s | √ |  | Single time |
| 147 | PV daily generation | 31509 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 148 | PV total generation | 31511 | 2 | RO | U32 | 100 | kWh | √ | √ |  |
| 149 | [DC Charger] Running state | 31513 | 1 | RO | U16 | N/A | N/A | √ |  | Refer to Appendix 14. |
| 150 | [DC Charger] Discharging current | 31514 | 1 | RO | U16 | 10 | A | √ |  |  |
| 151 | [DC Charger]Current discharging capacity | 31515 | 2 | RO | U32 | 100 | kWh | √ |  | Single time |
| 152 | [DC Charger]Current discharging duration | 31517 | 2 | RO | U32 | 1 | s | √ |  | Single time |
| 153 | [DC Charger]Total charging capacity | 31519 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 154 | [DC Charger]Total Discharging capacity | 31521 | 2 | RO | U32 | 100 | kWh | √ |  |  |
| 155 | [DC Charger]Rated charging power | 31523 | 2 | RO | U32 | 1000 | kW | √ |  |  |
| 156 | [DC Charger]Rated discharging power | 31525 | 2 | RO | U32 | 1000 | kW | √ |  |  |

<!-- page 45 -->
Modbus Protocol
5.4 Hybrid inverter(including DC Charger and ESS) parameter
setting register definition (holding register)
The registers below can only be accessed with a valid Hybrid inverter’s Modbus
slave address (1-246), and the Modbus slave address must be configured using
the MySigen APP.
Table 5-4 Hybrid inverter(including DC Charger and ESS) parameter setting
register definition
38 / 54

| No. | Name | Add. | QTY | Perm. | Data Type | Gain | Unit | Hybrid Inv, | PV inv. | Comment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Start/Stop | 40500 | 1 | WO | U16 | N/A | N/A | √ | √ | 0: Stop 1: Start |
| 2 | Reserved | 40501 | 1 | RW | U16 | N/A | N/A |  |  |  |
| 3 | [DC Charger] Start/Stop | 41000 | 1 | WO | U16 | N/A | N/A | √ |  | 0: Start 1: Stop |
| 4 | Reserved | 41001 | 1 | WO | U16 | N/A | N/A |  |  |  |
| 5 | [DC Charger] max charging power limit | 41002 | 2 | RW | U32 | 1000 | kW | √ |  | [0, Rated charging power]. |
| 6 | [DC Charger] max discharging power limit | 41004 | 2 | RW | U32 | 1000 | kW | √ |  | [0, Rated discharging power]. |
| 7 | Reserved | 41500 | 1 | RW | U16 | N/A | N/A |  | √ |  |
| 8 | Active power fixed value adjustment | 41501 | 2 | RW | S32 | 1000 | kW |  | √ |  |
| 9 | Reactive power fixed value adjustment | 41503 | 2 | RW | S32 | 1000 | kVar |  | √ |  |
| 10 | Active power percentage adjustment | 41505 | 1 | RW | S16 | 100 | % |  | √ |  |

<!-- page 46 -->
Modbus Protocol
5.5 AC-Charger running information register definition (input
register)
The registers below can only be accessed with a valid AC-Charger’s Modbus
slave address (1-246), and the Modbus slave address must be configured using
the MySigen APP. And are only applicable for “EVAC” devices.
Table 5-5 AC-Charger running information register definition
5.6 AC-Charger parameter setting register definition (holding
register)
The registers below can only be accessed with a valid AC-Charger’s modbus
39 / 54

| 11 | Reactive power Q/S adjustment | 41506 | 1 | RW | S16 | 100 | % |  | √ |  |
|---|---|---|---|---|---|---|---|---|---|---|
| 12 | Power factor adjustment | 41507 | 1 | RW | S16 | 1000 | N/A |  | √ |  |

| No. | Name | Add. | QTY | Perm. | Data Type | Gain | Unit | Comment |
|---|---|---|---|---|---|---|---|---|
| 1 | System state | 32000 | 1 | RO | U16 | N/A | N/A | System states according to IEC61851-1 definition. Refer to Appendix 7. |
| 2 | Total energy consumed | 32001 | 2 | RO | U32 | 100 | kWh |  |
| 3 | Charging power | 32003 | 2 | RO | S32 | 1000 | kW |  |
| 4 | Rated power | 32005 | 2 | RO | U32 | 1000 | kW |  |
| 5 | Rated current | 32007 | 2 | RO | S32 | 100 | A |  |
| 6 | Rated voltage | 32009 | 1 | RO | U16 | 10 | V |  |
| 7 | AC-Charger input breaker rated current | 32010 | 2 | RO | S32 | 100 | A |  |
| 8 | Alarm1 | 32012 | 1 | RO | U16 | N/A | N/A | Refer to Appendix 8 |
| 9 | Alarm2 | 32013 | 1 | RO | U16 | N/A | N/A | Refer to Appendix 9 |
| 10 | Alarm3 | 32014 | 1 | RO | U16 | N/A | N/A | Refer to Appendix 10 |

<!-- page 47 -->
Modbus Protocol
slave address (1-246), and the Modbus slave address must be configured using
the MySigen APP. And are only applicable for “EVAC” devices.
Table 5-6 AC-Charger parameter setting register definition
6. Modbus Protocol Command Overview
(1) MODBUS-RTU frame format
(2) MODBUS-TCP frame format
40 / 54

| No. | Name | Add. | QTY | Perm. | Data Type | Gain | Unit | Comment |
|---|---|---|---|---|---|---|---|---|
| 1 | Start/Stop | 42000 | 1 | WO | U16 | N/A | N/A | 0: Start 1: Stop |
| 2 | Charger output current | 42001 | 2 | RW | U32 | 100 | N/A | [6, X] X is the smaller value between the rated current and the AC-Charger input breaker rated current. |
| 3 | Reserved | 42003 | 1 | WO | U16 | N/A | N/A |  |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave Address | 1 | Customized by user (1~247) |
| PDU | X | Described in chapter 6.1 |
| Error Check | 2 | Crc16 check. It is worth pointing out that the byte order of CRC16 is the little-end mode |

<!-- page 48 -->
Modbus Protocol
6.1 Function code
6.1.1 Read Holding Register
Request
Response
Error
41 / 54

| Filed | Length(Bytes) | Description |
|---|---|---|
| Transmission identifier | 2 | Matching identifier between a request frame and a response frame |
| Protocol type | 2 | 0 = Modbus protocol |
| Data length | 2 | Follow-up data length |
| Slave Address | 1 | Customized by user (1~247) |

| Index | Function code | Description |
|---|---|---|
| 1 | 0x03 | Read Holding Register |
| 2 | 0x04 | Read Input Register |
| 3 | 0x06 | Write a single Register |
| 4 | 0x10 | Write multiple Registers |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Function code | 1 Byte | 0x03 |
| Starting address | 2 Bytes | 0x0000~0xFFFF |
| Quantity of registers | 2 Bytes | 1~124 |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Function code | 1 Byte | 0x03 |
| Byte count | 1 Byte | 2 x N |
| Register value | 2 x N Bytes | N=Quantity of Registers |

| Filed | Length(Bytes) | Description |
|---|---|---|

<!-- page 49 -->
Modbus Protocol
Example PDU: The following example contains only the slave address and the
Protocol Data Unit (PDU). If using Modbus RTU mode, a CRC16 should be added
at the end; if using Modbus TCP mode, an MBAP header should be added at the
beginning.
Example Meaning: Read the Rated active power register of the hybrid inverter
with Modbus slave address 1.
Host Query Command: 01 03 77 4C 00 02
Slave Normal Response: 01 03 04 00 00 61 A8
Slave Exception Response: 01 83 04
6.1.2 Read Input Register
Request
Response
Error
42 / 54

| Slave address | 1 Byte | 1~247 |
|---|---|---|
| Error code | 1 Byte | 0x83 |
| Exception code | 1 Byte | 01 or 02 or 03 or 04 |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Function code | 1 Byte | 0x04 |
| Starting address | 2 Bytes | 0x0000~0xFFFF |
| Quantity of registers | 2 Bytes | 1~124 |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Function code | 1 Byte | 0x04 |
| Byte count | 1 Byte | 2 x N |
| Register value | 2 x N Bytes | N=Quantity of Registers |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Error code | 1 Byte | 0x84 |

<!-- page 50 -->
Modbus Protocol
Example PDU: The following example contains only the slave address and the
Protocol Data Unit (PDU). If using Modbus RTU mode, a CRC16 should be added
at the end; if using Modbus TCP mode, an MBAP header should be added at the
beginning.
Example Meaning: Read the Active power fixed adjustment target value register
of a power plant with Modbus slave address 247.
Host Query Command: F7 04 9C 41 00 02
Slave Normal Response: F7 04 04 00 00 61 A8
Slave Exception Response: F7 84 04
6.1.3 Write a single Register
Request
Response
Error
Example PDU: The following example contains only the slave address and the
43 / 54

| Exception code | 1 Byte | 01 or 02 or 03 or 04 |
|---|---|---|

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 0~247 |
| Function code | 1 Byte | 0x06 |
| Register address | 2 Bytes | 0x0000~0xFFFF |
| Register value | 2 Bytes | 0x0000~0xFFFF |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Function code | 1 Byte | 0x06 |
| Register address | 2 Bytes | 0x0000~0xFFFF |
| Register value | 2 Bytes | 0x0000~0xFFFF |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Error code | 1 Byte | 0x86 |
| Exception code | 1 Byte | 01 or 02 or 03 or 04 |

<!-- page 51 -->
Modbus Protocol
Protocol Data Unit (PDU). If using Modbus RTU mode, a CRC16 should be added
at the end; if using Modbus TCP mode, an MBAP header should be added at the
beginning.
Example Meaning: Write the Start/Stop register of the hybrid inverter with
Modbus slave address 1.
Host Query Command: 01 06 9E 34 00 01
Slave Normal Response:01 06 9E 34 00 01
Slave Exception Response: 01 86 04
6.1.4 Write multiple Registers
Request
Response
Error
Example PDU: The following example contains only the slave address and the
44 / 54

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 0~247 |
| Function code | 1 Byte | 0x10 |
| Starting address | 2 Bytes | 0x0000~0xFFFF |
| Quantity of registers | 2 Bytes | 1~123 |
| Byte count | 1 Byte | 2 x N |
| Registers value | 2 x N Bytes | N=Quantity of Registers |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Function code | 1 Byte | 0x10 |
| Starting address | 2 Bytes | 0x0000~0xFFFF |
| Quantity of registers | 2 Bytes | 1~123 |

| Filed | Length(Bytes) | Description |
|---|---|---|
| Slave address | 1 Byte | 1~247 |
| Error code | 1 Byte | 0x90 |
| Exception code | 1 Byte | 01 or 02 or 03 or 04 |

<!-- page 52 -->
Modbus Protocol
Protocol Data Unit (PDU). If using Modbus RTU mode, a CRC16 should be added
at the end; if using Modbus TCP mode, an MBAP header should be added at the
beginning.
Example Meaning: Write the Active power fixed adjustment target value register
of a power plant with Modbus slave address 247.
Host Query Command: F7 10 9C 41 00 02 04 00 00 61 A8
Slave Normal Response: F7 10 9C 41 00 02
Slave Exception Response: F7 90 04
6.2 Exception code
45 / 54

| Code | Name | Meaning |
|---|---|---|
| 0x01 | ILLEGAL FUNCTION | The function code received in the query is not an allowable action for the server (or slave). This may be because the function code is only applicable to newer devices, and was not implemented in the unit selected. It could also indicate that the server (or slave) is in the wrong state to process a request of this type, for example because it is unconfigured and is being asked to return register values. |
| 0x02 | ILLEGAL DATA ADDRESS | The data address received in the query is not an allowable address for the server (or slave). More specifically, the combination of reference number and transfer length is invalid. |
| 0x03 | ILLEGAL DATA VALUE | A value contained in the query data field is not an allowable value for server (or slave). This indicates a fault in the structure of the remainder of a complex request, such as that the implied length is incorrect. It specifically does NOT mean that a data item submitted for storage in a register has a value outside the expectation of the application program, since the MODBUS |

<!-- page 53 -->
Modbus Protocol
Appendix 1 Running state
46 / 54

|  |  | protocol is unaware of the significance of any particular value of any particular register. |
|---|---|---|
| 0x04 | SLAVE DEVICE FAILURE | An unrecoverable error occurred while the server (or slave) was attempting to perform the requested action. |

| Running State | Value |
|---|---|
| Standby | 0x00 |
| Running | 0x01 |

<!-- page 54 -->
Modbus Protocol
Appendix 2 PCS alarm code -- 1
47 / 54

| Fault | 0x02 |
|---|---|
| Shutdown | 0x03 |
| Environmental Abnormality | 0x07 |

| Alarm Description | Bit |
|---|---|
| Software version mismatch | 0 |
| Low insulation resistance | 1 |
| Over-temperature | 2 |
| Equipment fault | 3 |
| System grounding fault | 4 |
| PV string over-voltage | 5 |
| PV string reversely connected | 6 |
| PV string back-filling | 7 |
| AFCI fault | 8 |
| Grid power outage | 9 |
| Grid over-voltage | 10 |
| Grid under-voltage | 11 |
| Grid over-frequency | 12 |
| Grid under-frequency | 13 |
| Grid voltage imbalance | 14 |
| DC component of output current out of limit | 15 |

<!-- page 55 -->
Modbus Protocol
Appendix 3 PCS alarm code -- 2
Appendix 4 ESS alarm code
48 / 54

| Alarm Description | Bit |
|---|---|
| Leak current out of limit | 0 |
| Communication abnormal | 1 |
| System internal protection | 2 |
| AFCI self-checking circuit fault | 3 |
| Off-grid protection | 4 |
| Manual operation protection | 5 |
| Abnormal phase sequence | 7 |
| Short circuit to PE | 8 |
| Soft start failure | 9 |
| Not defined | Not defined |

| Alarm Description | Bit |
|---|---|
| Software version mismatch | 0 |
| The energy storage module has low insulation resistance to ground | 1 |
| The temperature is too high | 2 |
| Equipment fault | 3 |
| Under-temperature | 4 |

<!-- page 56 -->
Modbus Protocol
Appendix 5 Gateway alarm code
Appendix 6 Remote EMS control mode
49 / 54

| Internal protection | 5 |
|---|---|
| Thermal runaway | 6 |
| Not defined | Not defined |

| Alarm Description | Bit |
|---|---|
| Software version mismatch | 0 |
| The temperature is too high | 1 |
| Equipment fault | 2 |
| Excessive leakage current in off-grid output | 3 |
| N line grounding fault | 4 |
| Abnormal phase sequence of grid wiring | 5 |
| Abnormal phase sequence of inverter wiring | 6 |
| Grid phase loss | 7 |
| Not defined | Not defined |

| Remote EMS control mode | Value |
|---|---|
| PCS remote control | 0x00 |
| Standby | 0x01 |

<!-- page 57 -->
Modbus Protocol
Appendix 7 AC-Charger system state
Appendix 8 AC-Charger alarm code -- 1
50 / 54

| Maximum self-consumption | 0x02 |
|---|---|
| Command charging (consume grid power first) | 0x03 |
| Command charging (consume PV power first) | 0x04 |
| Command discharging (output from PV first) | 0x05 |
| Command discharging (output from ESS first) | 0x06 |
| Reserved | 0x07 |
| V2G | 0x08 |

| System State | Value |
|---|---|
| System innit | 0x00 |
| A1/A2 | 0x01 |
| B1 | 0x02 |
| B2 | 0x03 |
| C1 | 0x04 |
| C2 | 0x05 |
| F | 0x06 |
| E | 0x07 |

| Alarm Description | Bit |
|---|---|
| Grid overvoltage | 0 |

<!-- page 58 -->
Modbus Protocol
Appendix 9 AC-Charger alarm code -- 2
51 / 54

| Grid undervoltage | 1 |
|---|---|
| Overload | 2 |
| Short circuit | 3 |
| Charging output overcurrent | 4 |
| Leak current out of limit | 5 |
| Grounding fault | 6 |
| Abnormal phase sequence of grid wiring | 7 |
| PEN Fault | 8 |
| Not defined | Not defined |

| Alarm Description | Bit |
|---|---|
| Leak current detection circuit fault | 0 |
| Relay stuck | 1 |
| Pilot circuit fault | 2 |
| Auxiliary power supply module fault | 3 |
| Electric lock fault | 4 |
| Lamp panel communication fault | 5 |
| Not defined | Not defined |

<!-- page 59 -->
Modbus Protocol
Appendix 10 AC-Charger alarm code -- 3
Appendix 11 DC-Charger alarm code
Appendix 12 Plant alarm -- 1
52 / 54

| Alarm Description | Bit |
|---|---|
| Too high internal temperature | 0 |
| Charging cable fault | 1 |
| Meter communication fault | 2 |
| Not defined | Not defined |

| Alarm Description | Bit |
|---|---|
| Software version mismatch | 0 |
| Low insulation resistance to ground | 1 |
| Over-temperature | 2 |
| Equipment fault | 3 |
| Charging fault | 4 |
| Equipment protection | 5 |
| Not defined | Not defined |

| Alarm Description | Bit |
|---|---|
| Gateway communication abnormal | 0 |
| Meter communication abnormal | 1 |

<!-- page 60 -->
Modbus Protocol
Appendix 13 Plant alarm -- 2
Appendix 14 DC-Charger running state
53 / 54

| AC power sensor communication abnormal | 2 |
|---|---|
| Hard protection against grid-feed power limit exceedance | 6 |
| Generator failure to start | 8 |
| CLS fault | 10 |
| Not defined | Not defined |

| Alarm Description | Bit |
|---|---|
| fault OVGR | 0 |
| RPR fault | 1 |
| Not defined | Not defined |

| Running State | Value |
|---|---|
| Idle | 0x00 |
| Occupied (Charging Gun plugged in but not detected) | 0x01 |
| Preparing (Establishing communication) | 0x02 |
| Charging | 0x03 |
| Fault | 0x04 |
| Scheduled | 0x05 |

<!-- page 61 -->
Modbus Protocol
54 / 54

| Ended | 0x06 |
|---|---|
| Unavailable (Under maintenance) | 0x07 |
| Discharging | 0x08 |
| Alarm | 0x09 |
| Preparing (Insulation detection in progress) | 0x0A |
