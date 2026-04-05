/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY www.code3721.com
 * Date:  12-08 07:48:00 
 */

const BaseAdminService = require('./base_admin_service.js');
const timeUtil = require('../../../framework/utils/time_util.js');

const MeetModel = require('../../model/meet_model.js');
const JoinModel = require('../../model/join_model.js');
const UserModel = require('../../model/user_model.js');

const DataService = require('./../data_service');

// 导出报名数据KEY
const EXPORT_JOIN_DATA_KEY = 'join_data';

// 导出用户数据KEY
const EXPORT_USER_DATA_KEY = 'user_data';

class AdminExportService extends BaseAdminService {
	// #####################导出报名数据
	/**获取报名数据 */
	async getJoinDataURL() {
		let dataService = new DataService();
		return await dataService.getExportDataURL(EXPORT_JOIN_DATA_KEY);
	}

	/**删除报名数据 */
	async deleteJoinDataExcel() {
		let dataService = new DataService();
		return await dataService.deleteDataExcel(EXPORT_JOIN_DATA_KEY);
	}

	// 根据表单提取数据
	_getValByForm(arr, mark, title) {
		for (let k in arr) {
			if (arr[k].mark == mark) return arr[k].val;
			if (arr[k].title == title) return arr[k].val;
		}

		return '';
	}

	/**导出报名数据 */
	async exportJoinDataExcel({
		meetId,
		startDay,
		endDay,
		status
	}) {
		let meet = await MeetModel.getOne({
			_id: meetId
		}, 'MEET_TITLE');
		if (!meet) this.AppError('预约项目不存在');

		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_MEET_DAY: ['between', startDay, endDay]
		};
		status = Number(status);
		if (status === 1 || status === 10 || status === 99) {
			where.JOIN_STATUS = status;
		}

		let orderBy = {
			JOIN_MEET_DAY: 'asc',
			JOIN_MEET_TIME_START: 'asc',
			JOIN_ADD_TIME: 'asc'
		};
		let fields = 'JOIN_CODE,JOIN_IS_CHECKIN,JOIN_MEET_TITLE,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_STATUS,JOIN_REASON,JOIN_FORMS,JOIN_USER_ID,JOIN_ADD_TIME';
		let list = await JoinModel.getAllBig(where, fields, orderBy);

		let data = [
			['预约项目', '预约日期', '预约时段', '状态', '是否签到', '姓名', '手机号', '预约码', '取消原因', '提交时间']
		];
		for (let k in list) {
			let node = list[k];
			let row = [];
			row.push(node.JOIN_MEET_TITLE || '');
			row.push(node.JOIN_MEET_DAY || '');
			row.push((node.JOIN_MEET_TIME_START || '') + '～' + (node.JOIN_MEET_TIME_END || ''));
			row.push(JoinModel.getDesc('STATUS', node.JOIN_STATUS) || '');
			row.push(node.JOIN_IS_CHECKIN ? '已签到' : '未签到');
			row.push(this._getValByForm(node.JOIN_FORMS || [], 'name', '姓名') || '');
			row.push(this._getValByForm(node.JOIN_FORMS || [], 'mobile', '手机') || '');
			row.push(node.JOIN_CODE || '');
			row.push(node.JOIN_REASON || '');
			row.push(timeUtil.timestamp2Time(node.JOIN_ADD_TIME) || '');
			data.push(row);
		}

		let title = meet.MEET_TITLE + '预约名单';
		let dataService = new DataService();
		return await dataService.exportDataExcel(EXPORT_JOIN_DATA_KEY, title, list.length, data);

	}


	// #####################导出用户数据

	/**获取用户数据 */
	async getUserDataURL() {
		let dataService = new DataService();
		return await dataService.getExportDataURL(EXPORT_USER_DATA_KEY);
	}

	/**删除用户数据 */
	async deleteUserDataExcel() {
		let dataService = new DataService();
		return await dataService.deleteDataExcel(EXPORT_USER_DATA_KEY);
	}

	/**导出用户数据 */
	async exportUserDataExcel(condition) {
		let where = {};
		if (condition) {
			try {
				where = JSON.parse(decodeURIComponent(condition));
			} catch (e) {}
		}

		let orderBy = {
			USER_ADD_TIME: 'desc'
		};
		let fields = 'USER_NAME,USER_MOBILE,USER_WORK,USER_CITY,USER_TRADE,USER_STATUS,USER_LOGIN_CNT,USER_LOGIN_TIME,USER_ADD_TIME';
		let list = await UserModel.getAllBig(where, fields, orderBy);

		let data = [
			['姓名', '手机号', '所在单位', '所在城市', '职业领域', '状态', '登录次数', '最近登录时间', '注册时间']
		];
		for (let k in list) {
			let node = list[k];
			let row = [];
			row.push(node.USER_NAME || '');
			row.push(node.USER_MOBILE || '');
			row.push(node.USER_WORK || '');
			row.push(node.USER_CITY || '');
			row.push(node.USER_TRADE || '');
			row.push(UserModel.getDesc('STATUS', node.USER_STATUS) || '');
			row.push(node.USER_LOGIN_CNT || 0);
			row.push(node.USER_LOGIN_TIME ? timeUtil.timestamp2Time(node.USER_LOGIN_TIME) : '');
			row.push(node.USER_ADD_TIME ? timeUtil.timestamp2Time(node.USER_ADD_TIME) : '');
			data.push(row);
		}

		let dataService = new DataService();
		return await dataService.exportDataExcel(EXPORT_USER_DATA_KEY, '用户数据', list.length, data);

	}
}

module.exports = AdminExportService;
