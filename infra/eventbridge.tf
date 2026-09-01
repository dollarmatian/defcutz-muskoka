resource "aws_cloudwatch_event_rule" "daily" {
  for_each = local.functions

  name                = "${var.name_prefix}-${each.key}-daily"
  description         = "Runs ${each.key} on a schedule."
  schedule_expression = var.schedule_expression
}

resource "aws_cloudwatch_event_target" "daily" {
  for_each = local.functions

  rule      = aws_cloudwatch_event_rule.daily[each.key].name
  target_id = "lambda"
  arn       = aws_lambda_function.function[each.key].arn
}

resource "aws_lambda_permission" "events" {
  for_each = local.functions

  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function[each.key].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily[each.key].arn
}
