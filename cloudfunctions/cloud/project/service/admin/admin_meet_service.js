/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY www.code3721.com
 * Date:  12-08 07:48:00 
 */

const BaseAdminService = require('./base_admin_service.js');
const MeetService = require('../meet_service.js');
const dataUtil = require('../../../framework/utils/data_util.js');
const timeUtil = require('../../../framework/utils/time_util.js');
const util = require('../../../framework/utils/util.js');
const cloudUtil = require('../../../framework/cloud/cloud_util.js');
const cloudBase = require('../../../framework/cloud/cloud_base.js');

const MeetModel = require('../../model/meet_model.js');
const JoinModel = require('../../model/join_model.js');
const DayModel = require('../../model/day_model.js');
const config = require('../../../config/config.js');

class AdminMeetService extends BaseAdminService {

	/** 预约数据列表 */
	async getDayList(meetId, start, end) {
		let where = {
			DAY_MEET_ID: meetId,
			day: ['between', start, end]
		}
		let orderBy = {
			day: 'asc'
		}
		return await DayModel.getAllBig(where, 'day,times,dayDesc', orderBy);
	}

	// 按项目统计人数
	async statJoinCntByMeet(meetId) {
		let today = timeUtil.time('Y-M-D');
		let where = {
			day: ['>=', today],
			DAY_MEET_ID: meetId
		}

		let meetService = new MeetService();
		let list = await DayModel.getAllBig(where, 'DAY_MEET_ID,times', {}, 1000);
		for (let k in list) {
			let meetId = list[k].DAY_MEET_ID;
			let times = list[k].times;

			for (let j in times) {
				let timeMark = times[j].mark;
				meetService.statJoinCnt(meetId, timeMark);
			}
		}
	}

	/** 自助签到码 */
	async genSelfCheckinQr(page, timeMark) {
		this.AppError('此功能暂不开放，如有需要请加作者微信：cclinux0730');
	}

	/** 管理员按钮核销 */
	async checkinJoin(joinId, flag) {
		this.AppError('此功能暂不开放，如有需要请加作者微信：cclinux0730');
	}

	/** 管理员扫码核销 */
	async scanJoin(meetId, code) {
		this.AppError('此功能暂不开放，如有需要请加作者微信：cclinux0730');
	}

	/**
	 * 判断本日是否有预约记录
	 * @param {*} daySet daysSet的节点
	 */
	checkHasJoinCnt(times) {
		if (!times) return false;
		for (let k in times) {
			if (times[k].stat.succCnt) return true;
		}
		return false;
	}

	// 判断含有预约的日期
	getCanModifyDaysSet(daysSet) {
		let now = timeUtil.time('Y-M-D');

		for (let k in daysSet) {
			if (daysSet[k].day < now) continue;
			daysSet[k].hasJoin = this.checkHasJoinCnt(daysSet[k].times);
		}

		return daysSet;
	}

	/** 取消某个时间段的所有预约记录 */
	async cancelJoinByTimeMark(admin, meetId, timeMark, reason) {
		this.AppError('此功能暂不开放，如有需要请加作者微信：cclinux0730');
	}


	/**添加 */
	async insertMeet(adminId, {
		title,
		order,
		typeId,
		typeName,
		daysSet,
		isShowLimit,
		formSet,
	}) {

		let data = {
			MEET_ADMIN_ID: adminId,
			MEET_TITLE: title,
			MEET_TYPE_ID: typeId,
			MEET_TYPE_NAME: typeName,
			MEET_ORDER: order,
			MEET_IS_SHOW_LIMIT: isShowLimit,
			MEET_FORM_SET: formSet,
			MEET_DAYS: daysSet.map(d => d.day),
			MEET_STYLE_SET: {
				desc: '',
				pic: ''
			}
		};

		let meetId = await MeetModel.insert(data);
		
		let nowDay = timeUtil.time('Y-M-D');
		await this._editDays(meetId, nowDay, daysSet);
		return { id: meetId };
	}

	/**删除数据 */
	async delMeet(id) {
		await MeetModel.del({ _id: id });
		await DayModel.del({ DAY_MEET_ID: id });
		await JoinModel.del({ JOIN_MEET_ID: id });
	}

	/**获取信息 */
	async getMeetDetail(id) {
		let fields = '*';

		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where, fields);
		if (!meet) return null;

		let meetService = new MeetService();
		meet.MEET_DAYS_SET = await meetService.getDaysSet(id, timeUtil.time('Y-M-D')); //今天及以后

		return meet;
	}

	/**
	 * 更新富文本详细的内容及图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateMeetContent({
		meetId,
		content // 富文本数组
	}) {

		await MeetModel.edit({ _id: meetId }, { MEET_CONTENT: content });

	}

	/**
	 * 更新封面内容及图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateMeetStyleSet({
		meetId,
		styleSet
	}) {

		await MeetModel.edit({ _id: meetId }, { MEET_STYLE_SET: styleSet });

	}

	/** 更新日期设置 */
	async _editDays(meetId, nowDay, daysSetData) {
		for (let k in daysSetData) {
			let dayData = daysSetData[k];
			if (dayData.day < nowDay) continue;

			let where = {
				DAY_MEET_ID: meetId,
				day: dayData.day
			};
			let existDay = await DayModel.getOne(where);
			if (existDay) {
				// merge times
				let existTimes = existDay.times;
				let newTimes = dayData.times;
				for (let j in newTimes) {
					let nt = newTimes[j];
					let et = existTimes.find(t => t.mark === nt.mark);
					if (et && et.stat) {
						nt.stat = et.stat;
					} else {
						nt.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 };
					}
				}
				await DayModel.edit(where, {
					dayDesc: dayData.dayDesc || dayData.desc,
					times: newTimes
				});
			} else {
				// insert
				let newTimes = dayData.times;
				for (let j in newTimes) {
					newTimes[j].stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 };
				}
				await DayModel.insert({
					DAY_MEET_ID: meetId,
					day: dayData.day,
					dayDesc: dayData.dayDesc || dayData.desc,
					times: newTimes
				});
			}
		}
		
		let allFutureDays = await DayModel.getAllBig({
			DAY_MEET_ID: meetId,
			day: ['>=', nowDay]
		});
		for (let k in allFutureDays) {
			let exist = daysSetData.find(d => d.day === allFutureDays[k].day);
			if (!exist) {
				// delete
				await DayModel.del({ _id: allFutureDays[k]._id });
			}
		}
	}

	/**更新数据 */
	async editMeet({
		id,
		title,
		typeId,
		typeName,
		order,
		daysSet,
		isShowLimit,
		formSet
	}) {
		let data = {
			MEET_TITLE: title,
			MEET_TYPE_ID: typeId,
			MEET_TYPE_NAME: typeName,
			MEET_ORDER: order,
			MEET_IS_SHOW_LIMIT: isShowLimit,
			MEET_FORM_SET: formSet,
			MEET_DAYS: daysSet.map(d => d.day),
		};
		await MeetModel.edit({ _id: id }, data);
		
		let nowDay = timeUtil.time('Y-M-D');
		await this._editDays(id, nowDay, daysSet);
	}

	/**预约名单分页列表 */
	async getJoinList({
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		meetId,
		mark,
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'JOIN_EDIT_TIME': 'desc'
		};
		let fields = 'JOIN_IS_CHECKIN,JOIN_CODE,JOIN_ID,JOIN_REASON,JOIN_USER_ID,JOIN_MEET_ID,JOIN_MEET_TITLE,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_MEET_TIME_MARK,JOIN_FORMS,JOIN_STATUS,JOIN_EDIT_TIME';

		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_MEET_TIME_MARK: mark
		};
		if (util.isDefined(search) && search) {
			where['JOIN_FORMS.val'] = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					// 按类型
					sortVal = Number(sortVal);
					if (sortVal == 1099) //取消的2种
						where.JOIN_STATUS = ['in', [10, 99]]
					else
						where.JOIN_STATUS = Number(sortVal);
					break;
				case 'checkin':
					// 签到
					where.JOIN_STATUS = JoinModel.STATUS.SUCC;
					if (sortVal == 1) {
						where.JOIN_IS_CHECKIN = 1;
					} else {
						where.JOIN_IS_CHECKIN = 0;
					}
					break;
			}
		}

		return await JoinModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/**预约项目分页列表 */
	async getMeetList({
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		whereEx, //附加查询条件
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'MEET_ORDER': 'asc',
			'MEET_ADD_TIME': 'desc'
		};
		let fields = 'MEET_TYPE,MEET_TYPE_NAME,MEET_TITLE,MEET_STATUS,MEET_DAYS,MEET_ADD_TIME,MEET_EDIT_TIME,MEET_ORDER';

		let where = {};
		if (util.isDefined(search) && search) {
			where.MEET_TITLE = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					// 按类型
					where.MEET_STATUS = Number(sortVal);
					break;
				case 'typeId':
					// 按类型
					where.MEET_TYPE_ID = sortVal;
					break;
				case 'sort':
					// 排序
					if (sortVal == 'view') {
						orderBy = {
							'MEET_VIEW_CNT': 'desc',
							'MEET_ADD_TIME': 'desc'
						};
					}

					break;
			}
		}

		return await MeetModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/** 删除 */
	async delJoin(joinId) {
		await JoinModel.del({ _id: joinId });

	}

	/**修改报名状态 
	 * 特殊约定 99=>正常取消 
	 */
	async statusJoin(admin, joinId, status, reason = '') {
		await JoinModel.edit({ _id: joinId }, { JOIN_STATUS: status, JOIN_REASON: reason });
	}

	/**修改项目状态 */
	async statusMeet(id, status) {
		await MeetModel.edit({ _id: id }, { MEET_STATUS: status });
	}

	/**置顶排序设定 */
	async sortMeet(id, sort) {
		await MeetModel.edit({ _id: id }, { MEET_ORDER: sort });
	}
}

module.exports = AdminMeetService;