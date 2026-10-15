import { reactive } from "vue";
import type { FormRules } from "element-plus";

/** 登录校验（邮箱+密码） */
const loginRules = reactive<FormRules>({
  email: [
    {
      required: true,
      message: "请输入邮箱",
      trigger: "blur"
    },
    {
      type: "email",
      message: "请输入正确的邮箱地址",
      trigger: "blur"
    }
  ],
  password: [
    {
      required: true,
      message: "请输入密码",
      trigger: "blur"
    }
  ]
});

export { loginRules };
